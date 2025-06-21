/**
 * @fileoverview Export service for generating and caching task exports with BullMQ queue
 * @module services/exportService
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import Task from '../models/Task.js';
import ExportHistory, { EXPORT_FORMATS } from '../models/ExportHistory.js';
import { redisClient } from '../config/redis.js';
import { addExportJob } from '../config/queue.js';
import {
  buildQueryFromFilters,
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
   * Checks if export data is stale based on task changes after export creation
   * @static
   * @param {Object} filters - Export filter parameters
   * @param {Date} exportCreationDate - When the export was created
   * @returns {Promise<boolean>} True if export is stale and needs refresh
   */
  static async isExportStale(filters, exportCreationDate) {
    try {
      // Build query from filters to find relevant tasks
      const query = buildQueryFromFilters(filters);

      // Add condition to find tasks created or updated after export creation
      const staleQuery = {
        ...query,
        $or: [
          { createdAt: { $gt: exportCreationDate } }, // New tasks created after export
          { updatedAt: { $gt: exportCreationDate } } // Existing tasks updated after export
        ]
      };

      // Check if any matching tasks exist (limit 1 for performance)
      const staleTasks = await Task.findOne(staleQuery).select('_id').lean();

      const isStale = staleTasks !== null;

      if (isStale) {
        console.log(
          `📊 Export is stale - found tasks modified after ${exportCreationDate.toISOString()}`
        );
      } else {
        console.log(
          `✅ Export is fresh - no changes since ${exportCreationDate.toISOString()}`
        );
      }

      return isStale;
    } catch (error) {
      console.error('Error checking export staleness:', error);
      // On error, assume stale to be safe
      return true;
    }
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

      // Check database for existing completed export
      const existingExport = await ExportHistory.findOne({
        filters: { $eq: filters },
        format,
        status: 'completed',
        filePath: { $ne: null }
      }).sort({ completedAt: -1 });

      if (existingExport) {
        console.log(
          `🔍 Found existing completed export: ${existingExport.exportId}`
        );

        const isStale = await this.isExportStale(
          filters,
          existingExport.completedAt
        );
        if (!isStale) {
          console.log('✅ Existing export is fresh - reusing and re-caching');

          // Re-cache the existing export
          const cacheData = {
            exportId: existingExport.exportId,
            filePath: existingExport.filePath,
            fileSize: existingExport.fileSize,
            taskCount: existingExport.taskCount,
            mimeType: getMimeType(existingExport.format),
            filename: `tasks-${new Date().toISOString().split('T')[0]}-${existingExport.taskCount}.${existingExport.format}`,
            format: existingExport.format,
            createdAt: existingExport.completedAt.toISOString()
          };

          await redisClient.setex(
            `export_data:${existingExport.exportId}`,
            this.CACHE_TTL,
            JSON.stringify(cacheData)
          );

          return {
            exportId: existingExport.exportId,
            status: 'completed',
            cached: true,
            taskCount: existingExport.taskCount,
            fileSize: existingExport.fileSize,
            message: 'Export retrieved from database'
          };
        }

        console.log('📊 Existing export is stale - will create new one');
      }

      // Validate task count for new export
      const exportId = this.generateExportId();
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

      // Create new export record
      const exportHistory = new ExportHistory({
        exportId,
        filters,
        format,
        status: 'pending'
      });
      await exportHistory.save();

      // Queue export job
      const job = await addExportJob(
        {
          exportId,
          filters,
          format,
          totalCount
        },
        {
          priority: totalCount > 10000 ? 1 : 5,
          delay: 500,
          attempts: 1 // Disable retries for export jobs
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
   * Repeats a failed export with the same parameters
   * @static
   * @param {string} exportId - Export identifier to repeat
   * @returns {Promise<Object>} Export repeat result
   */
  static async repeatExport(exportId) {
    try {
      // Find the existing export
      const existingExport = await ExportHistory.findOne({ exportId });

      if (!existingExport) {
        throw new Error('Export not found');
      }

      // Only allow repeating failed exports
      if (existingExport.status !== 'failed') {
        throw new Error(
          `Export with status '${existingExport.status}' cannot be repeated. Only failed exports can be repeated.`
        );
      }

      console.log(`🔄 Repeating failed export: ${exportId}`);

      const { filters, format } = existingExport;

      // Validate task count for the repeat export
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

      // Clean up any existing partial file
      if (existingExport.filePath) {
        try {
          await fs.unlink(existingExport.filePath);
          console.log(`🗑️ Cleaned up partial file: ${existingExport.filePath}`);
        } catch (error) {
          console.log(
            `⚠️ Could not clean up file ${existingExport.filePath}:`,
            error.message
          );
        }
      }

      // Reset the existing export record for retry
      await ExportHistory.findOneAndUpdate(
        { exportId },
        {
          status: 'pending',
          fileSize: 0,
          taskCount: 0,
          completedAt: null,
          errorMessage: null,
          filePath: null,
          createdAt: new Date() // Update timestamp for fresh attempt
        }
      );

      // Queue export job with higher priority for repeats
      const job = await addExportJob(
        {
          exportId,
          filters,
          format,
          totalCount,
          isRepeat: true
        },
        {
          priority: 10, // Higher priority for repeat exports
          delay: 500,
          attempts: 1 // Disable retries for export jobs
        }
      );

      console.log(
        `📋 Repeat export job ${job.id} added to queue for exportId: ${exportId}`
      );

      return {
        exportId,
        jobId: job.id,
        status: 'pending',
        cached: false,
        estimatedRecords: totalCount,
        message: 'Export repeat queued for processing'
      };
    } catch (error) {
      console.error('Failed to repeat export:', error);
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
      // FIRST: Check Redis cache using exportId
      const exportCacheKey = `export_data:${exportId}`;
      const cachedExportData = await redisClient.get(exportCacheKey);

      if (cachedExportData) {
        console.log(`🚀 Cache hit for export ${exportId}`);
        const exportData = JSON.parse(cachedExportData);

        // File-based export - verify file still exists
        try {
          await fs.access(exportData.filePath);

          return {
            filename: exportData.filename,
            mimeType: exportData.mimeType,
            fileSize: exportData.fileSize,
            filePath: exportData.filePath
          };
        } catch (error) {
          console.log(`📁 Cached file not found: ${exportData.filePath}`);
          console.log('Not found error', error.message);
          // File not found, remove from cache and fall through to database
          await redisClient.del(exportCacheKey);
        }
      }

      console.log(`💾 Cache miss for export ${exportId}, checking database`);

      // SECOND: Cache miss - check database
      const exportHistory = await ExportHistory.findOne({ exportId });

      if (!exportHistory) {
        throw new Error('Export not found');
      }

      if (exportHistory.status !== 'completed') {
        throw new Error(`Export not ready. Status: ${exportHistory.status}`);
      }

      // Check if we have file path
      if (!exportHistory.filePath) {
        throw new Error('Export data not found - no file path');
      }

      // Check if file exists on disk
      try {
        await fs.access(exportHistory.filePath);
      } catch (error) {
        console.log('Access error - getExportData', error.message);
        throw new Error('Export file not found or expired');
      }

      const stats = await fs.stat(exportHistory.filePath);

      // Generate response data
      const responseData = {
        filename: generateFilename(
          exportHistory.format,
          exportHistory.filters,
          exportHistory.taskCount
        ),
        mimeType: getMimeType(exportHistory.format),
        fileSize: stats.size,
        filePath: exportHistory.filePath
      };

      // Cache the response for future requests (without the 'data' field to save memory)
      const cacheData = {
        filePath: exportHistory.filePath,
        filename: responseData.filename,
        mimeType: responseData.mimeType,
        fileSize: responseData.fileSize,
        format: exportHistory.format,
        createdAt: new Date().toISOString()
      };

      await redisClient.setex(
        exportCacheKey,
        this.CACHE_TTL,
        JSON.stringify(cacheData)
      );

      return responseData;
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

  static validate;
}

export default ExportService;
