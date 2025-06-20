/**
 * @fileoverview Export service for generating and caching task exports
 * @module services/exportService
 */

import crypto from 'crypto';
import Task from '../models/Task.js';
import ExportHistory, {
  EXPORT_FORMATS,
  EXPORT_STATUSES
} from '../models/ExportHistory.js';
import { redisClient } from '../config/redis.js';
import {
  formatAsCSV,
  formatAsJSON,
  prepareTaskData
} from '../utils/exportFormatters.js';

/**
 * Export service for handling task data exports
 * @class ExportService
 */
class ExportService {
  /**
   * Cache TTL in seconds (30 minutes)
   * @constant {number}
   */
  static CACHE_TTL = 30 * 60;

  /**
   * Cache TTL in milliseconds (30 minutes) - for database calculations
   * @constant {number}
   */
  static CACHE_TTL_MS = 30 * 60 * 1000;

  /**
   * Maximum export size (100k tasks)
   * @constant {number}
   */
  static MAX_EXPORT_SIZE = 100000;

  /**
   * Generates a unique export ID
   * @static
   * @returns {string} Unique export identifier
   */
  static generateExportId() {
    return `export_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generates cache key based on filters and format
   * @static
   * @param {Object} filters - Filter parameters
   * @param {string} format - Export format
   * @returns {string} Cache key
   */
  static generateCacheKey(filters, format) {
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    const hash = crypto
      .createHash('md5')
      .update(filterString + format)
      .digest('hex');
    return `export:${hash}`;
  }

  /**
   * Builds MongoDB query from filters
   * @static
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB query object
   */
  static buildQueryFromFilters(filters) {
    const query = {};

    // Status filtering
    if (filters.status && filters.status.length > 0) {
      query.status =
        Array.isArray(filters.status) && filters.status.length === 1
          ? filters.status[0]
          : {
              $in: Array.isArray(filters.status)
                ? filters.status
                : [filters.status]
            };
    }

    // Priority filtering
    if (filters.priority && filters.priority.length > 0) {
      query.priority =
        Array.isArray(filters.priority) && filters.priority.length === 1
          ? filters.priority[0]
          : {
              $in: Array.isArray(filters.priority)
                ? filters.priority
                : [filters.priority]
            };
    }

    // Date range filtering for createdAt
    if (filters.createdFrom || filters.createdTo) {
      query.createdAt = {};
      if (filters.createdFrom) {
        query.createdAt.$gte = new Date(filters.createdFrom);
      }
      if (filters.createdTo) {
        const endDate = new Date(filters.createdTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Date range filtering for completedAt
    if (filters.completedFrom || filters.completedTo) {
      query.completedAt = {};
      if (filters.completedFrom) {
        query.completedAt.$gte = new Date(filters.completedFrom);
      }
      if (filters.completedTo) {
        const endDate = new Date(filters.completedTo);
        endDate.setHours(23, 59, 59, 999);
        query.completedAt.$lte = endDate;
      }
    }

    return query;
  }

  /**
   * Gets sort options from filters
   * @static
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB sort object
   */
  static getSortOptions(filters) {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    return { [sortBy]: sortOrder };
  }

  /**
   * Initiates an export request
   * @static
   * @param {Object} filters - Filter parameters
   * @param {string} format - Export format (csv/json)
   * @param {Object} socketHandlers - Socket handlers for real-time updates
   * @returns {Promise<Object>} Export initiation result
   */
  static async initiateExport(filters, format, socketHandlers = null) {
    try {
      // Validate format
      if (!EXPORT_FORMATS.includes(format)) {
        throw new Error(`Invalid export format: ${format}`);
      }

      const exportId = this.generateExportId();
      const cacheKey = this.generateCacheKey(filters, format);

      // Check if export already exists in cache
      const cachedExport = await redisClient.get(cacheKey);
      if (cachedExport) {
        const exportData = JSON.parse(cachedExport);

        // Create export history record for cached result
        const exportHistory = new ExportHistory({
          exportId,
          filters,
          format,
          status: 'completed',
          fileSize: exportData.size,
          taskCount: exportData.taskCount,
          cacheKey,
          completedAt: new Date()
        });
        await exportHistory.save();

        return {
          exportId,
          status: 'completed',
          cached: true,
          taskCount: exportData.taskCount,
          fileSize: exportData.size
        };
      }

      // Create export history record
      const exportHistory = new ExportHistory({
        exportId,
        filters,
        format,
        status: 'pending',
        cacheKey
      });
      await exportHistory.save();

      // Emit initial progress if socket handlers available
      if (socketHandlers) {
        socketHandlers.broadcastExportProgress(
          exportId,
          0,
          'Initializing export...'
        );
      }

      // Process export asynchronously
      this.processExport(
        exportId,
        filters,
        format,
        cacheKey,
        socketHandlers
      ).catch(async (error) => {
        console.error(`Export ${exportId} failed:`, error);
        await ExportHistory.findOneAndUpdate(
          { exportId },
          {
            status: 'failed',
            errorMessage: error.message
          }
        );

        if (socketHandlers) {
          socketHandlers.broadcastExportError(exportId, error.message);
        }
      });

      return {
        exportId,
        status: 'pending',
        cached: false,
        message: 'Export initiated successfully'
      };
    } catch (error) {
      console.error('Failed to initiate export:', error);
      throw error;
    }
  }

  /**
   * Processes the export generation
   * @static
   * @private
   * @param {string} exportId - Export identifier
   * @param {Object} filters - Filter parameters
   * @param {string} format - Export format
   * @param {string} cacheKey - Redis cache key
   * @param {Object} socketHandlers - Socket handlers for real-time updates
   * @returns {Promise<void>}
   */
  static async processExport(
    exportId,
    filters,
    format,
    cacheKey,
    socketHandlers
  ) {
    try {
      // Update status to processing
      await ExportHistory.findOneAndUpdate(
        { exportId },
        { status: 'processing' }
      );

      if (socketHandlers) {
        socketHandlers.broadcastExportProgress(
          exportId,
          10,
          'Querying database...'
        );
      }

      // Build query and get tasks
      const query = this.buildQueryFromFilters(filters);
      const sortOptions = this.getSortOptions(filters);

      // Get total count first for progress tracking
      const totalCount = await Task.countDocuments(query);

      if (totalCount > this.MAX_EXPORT_SIZE) {
        throw new Error(
          `Export too large: ${totalCount} tasks exceeds maximum of ${this.MAX_EXPORT_SIZE}`
        );
      }

      if (socketHandlers) {
        socketHandlers.broadcastExportProgress(
          exportId,
          30,
          `Found ${totalCount} tasks...`
        );
      }

      // Fetch tasks with streaming for large datasets
      const tasks = await Task.find(query).sort(sortOptions).lean();

      if (socketHandlers) {
        socketHandlers.broadcastExportProgress(
          exportId,
          60,
          'Formatting data...'
        );
      }

      // Prepare and format data
      const taskData = prepareTaskData(tasks);
      let formattedData;

      switch (format) {
        case 'csv':
          formattedData = formatAsCSV(taskData);
          break;
        case 'json':
          formattedData = formatAsJSON(taskData);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const fileSize = Buffer.byteLength(formattedData, 'utf8');

      if (socketHandlers) {
        socketHandlers.broadcastExportProgress(
          exportId,
          80,
          'Caching results...'
        );
      }

      // Cache the export data
      const cacheData = {
        data: formattedData,
        size: fileSize,
        taskCount: tasks.length,
        format,
        createdAt: new Date().toISOString()
      };

      await redisClient.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(cacheData)
      );

      // Update export history
      await ExportHistory.findOneAndUpdate(
        { exportId },
        {
          status: 'completed',
          fileSize,
          taskCount: tasks.length,
          completedAt: new Date()
        }
      );

      if (socketHandlers) {
        socketHandlers.broadcastExportCompleted(exportId, {
          taskCount: tasks.length,
          fileSize,
          format
        });
      }
    } catch (error) {
      console.error(`Export processing failed for ${exportId}:`, error);

      await ExportHistory.findOneAndUpdate(
        { exportId },
        {
          status: 'failed',
          errorMessage: error.message
        }
      );

      throw error;
    }
  }

  /**
   * Retrieves export data for download
   * @static
   * @param {string} exportId - Export identifier
   * @returns {Promise<Object>} Export data and metadata
   */
  static async getExportData(exportId) {
    try {
      const exportHistory = await ExportHistory.findOne({ exportId });

      if (!exportHistory) {
        throw new Error('Export not found');
      }

      if (exportHistory.status !== 'completed') {
        throw new Error(`Export not ready. Status: ${exportHistory.status}`);
      }

      // Get cached data
      const cachedData = await redisClient.get(exportHistory.cacheKey);

      if (!cachedData) {
        throw new Error('Export data not found in cache');
      }

      const exportData = JSON.parse(cachedData);

      // Increment download count
      await exportHistory.incrementDownloadCount();

      return {
        data: exportData.data,
        filename: this.generateFilename(
          exportHistory.format,
          exportHistory.filters,
          exportHistory.taskCount
        ),
        mimeType: this.getMimeType(exportHistory.format),
        fileSize: exportData.size
      };
    } catch (error) {
      console.error('Failed to retrieve export data:', error);
      throw error;
    }
  }

  /**
   * Gets export status
   * @static
   * @param {string} exportId - Export identifier
   * @returns {Promise<Object>} Export status information
   */
  static async getExportStatus(exportId) {
    try {
      const exportHistory = await ExportHistory.findOne({ exportId });

      if (!exportHistory) {
        throw new Error('Export not found');
      }

      return {
        exportId: exportHistory.exportId,
        status: exportHistory.status,
        progress: this.calculateProgress(exportHistory.status),
        taskCount: exportHistory.taskCount,
        fileSize: exportHistory.fileSize,
        createdAt: exportHistory.createdAt,
        completedAt: exportHistory.completedAt,
        errorMessage: exportHistory.errorMessage,
        isExpired: exportHistory.isExpired()
      };
    } catch (error) {
      console.error('Failed to get export status:', error);
      throw error;
    }
  }

  /**
   * Gets user's export history
   * @static
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated export history
   */
  static async getExportHistory(options = {}) {
    try {
      const { page = 1, limit = 20, status, format } = options;

      const query = {};

      if (status) {
        query.status = status;
      }

      if (format) {
        query.format = format;
      }

      const skip = (page - 1) * limit;

      const [exports, total] = await Promise.all([
        ExportHistory.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ExportHistory.countDocuments(query)
      ]);

      return {
        exports: exports.map((exp) => {
          // Calculate expiration for lean objects
          const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
          const expirationTime = new Date(
            exp.createdAt.getTime() + CACHE_TTL_MS
          );
          const isExpired = new Date() > expirationTime;

          return {
            ...exp,
            isExpired
          };
        }),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Failed to get export history:', error);
      throw error;
    }
  }

  /**
   * Calculates progress percentage based on status
   * @static
   * @private
   * @param {string} status - Export status
   * @returns {number} Progress percentage
   */
  static calculateProgress(status) {
    switch (status) {
      case 'pending':
        return 0;
      case 'processing':
        return 50;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Generates filename for export
   * @static
   * @private
   * @param {string} format - Export format
   * @param {Object} filters - Applied filters
   * @param {number} taskCount - Number of tasks
   * @returns {string} Generated filename
   */
  static generateFilename(format, filters, taskCount) {
    const date = new Date().toISOString().split('T')[0];
    const filterCount = Object.keys(filters).filter(
      (key) =>
        filters[key] &&
        (Array.isArray(filters[key]) ? filters[key].length > 0 : true)
    ).length;
    const suffix =
      filterCount > 0 ? `-filtered-${taskCount}` : `-all-${taskCount}`;
    return `tasks-${date}${suffix}.${format}`;
  }

  /**
   * Gets MIME type for format
   * @static
   * @private
   * @param {string} format - Export format
   * @returns {string} MIME type
   */
  static getMimeType(format) {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Cleans up expired export history records
   * @static
   * @async
   * @returns {Promise<number>} Number of records cleaned up
   */
  static async cleanupExpiredExports() {
    try {
      const cutoffTime = new Date(Date.now() - this.CACHE_TTL_MS);

      const result = await ExportHistory.deleteMany({
        createdAt: { $lt: cutoffTime },
        status: { $in: ['completed', 'failed'] }
      });

      console.log(
        `🧹 Cleaned up ${result.deletedCount} expired export records`
      );
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired exports:', error);
      return 0;
    }
  }
}

export default ExportService;
