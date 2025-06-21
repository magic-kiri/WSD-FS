/**
 * @fileoverview Export service for generating and caching task exports with BullMQ queue
 * @module services/exportService
 */

import crypto from 'crypto';
import Task from '../models/Task.js';
import ExportHistory, { EXPORT_FORMATS } from '../models/ExportHistory.js';
import { redisClient } from '../config/redis.js';
import { addExportJob } from '../config/queue.js';
import {
  buildQueryFromFilters,
  generateCacheKey,
  generateFilename,
  getMimeType
} from '../utils/exportFormatters.js';

/**
 * Export service for handling task data exports with queue processing
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
   * Initiates an export request using BullMQ queue
   * @static
   * @param {Object} filters - Filter parameters
   * @param {string} format - Export format (csv/json)
   * @returns {Promise<Object>} Export initiation result
   */
  static async initiateExport(filters, format) {
    try {
      // Validate format
      if (!EXPORT_FORMATS.includes(format)) {
        throw new Error(`Invalid export format: ${format}`);
      }

      const exportId = this.generateExportId();
      const cacheKey = generateCacheKey(filters, format);

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

      // Quick validation - check if any tasks exist
      const query = buildQueryFromFilters(filters);
      const totalCount = await Task.countDocuments(query);

      if (totalCount > this.MAX_EXPORT_SIZE) {
        throw new Error(
          `Export too large: ${totalCount} tasks exceeds maximum of ${this.MAX_EXPORT_SIZE}`
        );
      }

      if (totalCount === 0) {
        throw new Error('No tasks found matching the filters');
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

      // Add job to queue
      const job = await addExportJob(
        {
          exportId,
          filters,
          format,
          totalCount
        },
        {
          priority: totalCount > 10000 ? 1 : 5, // Lower priority for larger exports
          delay: 500 // Small delay to allow response to be sent
        }
      );

      console.log(
        `📋 Export job ${job.id} added to queue for exportId: ${exportId}`
      );

      return {
        exportId,
        jobId: job.id,
        status: 'pending',
        cached: false,
        estimatedRecords: totalCount,
        message: 'Export queued for processing'
      };
    } catch (error) {
      console.error('Failed to initiate export:', error);
      throw error;
    }
  }

  /**
   * Gets export status from queue or database
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

      // If completed or failed, return from database
      if (
        exportHistory.status === 'completed' ||
        exportHistory.status === 'failed'
      ) {
        return {
          exportId: exportHistory.exportId,
          status: exportHistory.status,
          progress: exportHistory.status === 'completed' ? 100 : 0,
          taskCount: exportHistory.taskCount,
          fileSize: exportHistory.fileSize,
          createdAt: exportHistory.createdAt,
          completedAt: exportHistory.completedAt,
          errorMessage: exportHistory.errorMessage,
          isExpired: exportHistory.isExpired()
        };
      }

      // For pending/processing, return database status with calculated progress
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
      const cacheKey = generateCacheKey(
        exportHistory.filters,
        exportHistory.format
      );
      console.log('🚀 Cache key:', cacheKey);
      // Get cached data
      const cachedData = await redisClient.get(cacheKey);

      if (!cachedData) {
        throw new Error('Export data not found in cache');
      }

      const exportData = JSON.parse(cachedData);

      // Increment download count
      await exportHistory.incrementDownloadCount();

      return {
        data: exportData.data,
        filename: generateFilename(
          exportHistory.format,
          exportHistory.filters,
          exportHistory.taskCount
        ),
        mimeType: getMimeType(exportHistory.format),
        fileSize: exportData.size
      };
    } catch (error) {
      console.error('Failed to retrieve export data:', error);
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
          const expirationTime = new Date(
            exp.createdAt.getTime() + this.CACHE_TTL_MS
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
      return 5;
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
   * Cleans up expired export history records
   * @static
   * @async
   * @returns {Promise<number>} Number of records cleaned up
   */
  static async cleanupExpiredExports() {
    try {
      const cutoffTime = new Date(Date.now() - this.CACHE_TTL_MS);

      // Delete database records
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
