/**
 * @fileoverview Export worker for processing export jobs with streaming and chunked processing
 * @module workers/exportWorker
 */

import { Worker } from 'bullmq';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import Task from '../models/Task.js';
import ExportHistory from '../models/ExportHistory.js';
import { redisClient } from '../config/redis.js';
import { exportQueue } from '../config/queue.js';
import {
  buildQueryFromFilters,
  formatTaskForExport,
  taskToCsvRow,
  getDefaultFields
} from '../utils/exportFormatters.js';

/**
 * Chunk size for processing (records per batch)
 */
const CHUNK_SIZE = process.env.EXPORT_WORKER_CHUNK_SIZE || 1000;

/**
 * Export worker class
 */
class ExportWorker {
  constructor(socketHandlers = null) {
    this.socketHandlers = socketHandlers;
    this.worker = null;
  }

  /**
   * Initialize and start the worker
   */
  start() {
    // Use the same connection configuration as the queue
    const redisConnection = exportQueue.opts.connection;

    this.worker = new Worker('export-processing', this.processJob.bind(this), {
      connection: redisConnection,
      concurrency: process.env.EXPORT_WORKER_CONCURRENCY || 2,
      limiter: {
        max: 10,
        duration: 60000 // 10 jobs per minute max
      }
    });

    this.worker.on('completed', (job) => {
      console.log(`✅ Export job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Export job ${job.id} failed:`, err.message);
    });

    this.worker.on('progress', (job, progress) => {
      console.log(`📊 Export job ${job.id} progress: ${progress}%`);
    });

    console.log('🔄 Export worker started');
  }

  /**
   * Stop the worker
   */
  async stop() {
    if (this.worker) {
      await this.worker.close();
      console.log('🛑 Export worker stopped');
    }
  }

  /**
   * Process export job
   * @param {Object} job - BullMQ job instance
   * @returns {Promise<Object>} Job result
   */
  async processJob(job) {
    console.log('🚀 Processing export job:', job.data);
    const { exportId, filters, format, totalCount } = job.data;

    try {
      console.log(`🚀 Processing export job: ${exportId}`);

      // Update status to processing
      await ExportHistory.findOneAndUpdate(
        { exportId },
        { status: 'processing' }
      );

      this.broadcastProgress(exportId, 5, 'Starting export processing...');
      await job.updateProgress(5);

      this.broadcastProgress(
        exportId,
        15,
        `Found ${totalCount.toLocaleString()} tasks`
      );
      await job.updateProgress(15);

      // Process with streaming to file (not memory)
      const result = await this.processWithStreamingToFile({
        exportId,
        filters,
        format,
        totalCount,
        job
      });

      // Also cache by exportId for faster direct lookups
      const exportCacheKey = `export_data:${exportId}`;
      const exportCacheData = {
        filePath: result.filePath,
        filename: `tasks-${new Date().toISOString().split('T')[0]}-${result.recordCount}.${format}`,
        mimeType: format === 'csv' ? 'text/csv' : 'application/json',
        fileSize: result.fileSize,
        format,
        createdAt: new Date().toISOString()
      };

      await redisClient.setex(
        exportCacheKey,
        30 * 60,
        JSON.stringify(exportCacheData)
      );

      // Update export history
      await ExportHistory.findOneAndUpdate(
        { exportId },
        {
          status: 'completed',
          fileSize: result.fileSize,
          taskCount: result.recordCount,
          completedAt: new Date(),
          filePath: result.filePath // Store file path in DB
        }
      );

      this.broadcastCompleted(exportId, {
        taskCount: result.recordCount,
        fileSize: result.fileSize,
        format
      });

      await job.updateProgress(100);

      return {
        exportId,
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        filePath: result.filePath
      };
    } catch (error) {
      console.error(`Export processing failed for ${exportId}:`, error);

      await ExportHistory.findOneAndUpdate(
        { exportId },
        {
          status: 'failed',
          errorMessage: error.message
        }
      );

      this.broadcastError(exportId, error.message);
      throw error;
    }
  }

  /**
   * Process export with streaming to file instead of memory accumulation
   * @param {Object} params - Processing parameters
   * @returns {Promise<Object>} Processing result
   */
  async processWithStreamingToFile({
    exportId,
    filters,
    format,
    totalCount,
    job
  }) {
    // Create exports directory
    const exportDir = path.join(process.cwd(), 'temp-exports');
    await fs.mkdir(exportDir, { recursive: true });

    const tempFilePath = path.join(exportDir, `${exportId}.${format}`);

    // Clean up any existing partial file before starting
    try {
      await fs.unlink(tempFilePath);
      console.log(`🗑️ Cleaned up existing partial file: ${tempFilePath}`);
    } catch (error) {
      // File doesn't exist, which is fine
      if (error.code !== 'ENOENT') {
        console.log(
          `⚠️ Could not clean up existing file ${tempFilePath}:`,
          error.message
        );
      }
    }

    try {
      if (format === 'csv') {
        await this.streamToCSV(
          filters,
          tempFilePath,
          totalCount,
          job,
          exportId
        );
      } else if (format === 'json') {
        await this.streamToJSON(
          filters,
          tempFilePath,
          totalCount,
          job,
          exportId
        );
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const stats = await fs.stat(tempFilePath);
      return {
        filePath: tempFilePath,
        fileSize: stats.size,
        recordCount: totalCount
      };
    } catch (error) {
      // Cleanup on error
      await fs.unlink(tempFilePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Stream tasks to CSV file
   * @param {Object} filters - Export filters
   * @param {string} filePath - Output file path
   * @param {number} totalCount - Total number of tasks
   * @param {Object} job - BullMQ job instance
   * @param {string} exportId - Export ID
   */
  async streamToCSV(filters, filePath, totalCount, job, exportId) {
    const writeStream = createWriteStream(filePath);

    // Write CSV headers
    const headers = getDefaultFields();
    writeStream.write(headers.join(',') + '\n');

    const sort = { createdAt: -1 };
    if (filters.sortBy && filters.sortOrder) {
      sort[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
    }

    // Optimize cursor with projection and batch size
    const cursor = Task.find(buildQueryFromFilters(filters))
      .lean()
      .sort(sort)
      .cursor({ batchSize: CHUNK_SIZE });

    let processedCount = 0;
    let currentChunk = [];

    for await (const task of cursor) {
      const formattedTask = formatTaskForExport(task);
      currentChunk.push(taskToCsvRow(formattedTask));
      processedCount++;

      // Write chunk when it reaches limit
      if (currentChunk.length >= CHUNK_SIZE) {
        writeStream.write(currentChunk.join('\n') + '\n');
        currentChunk = []; // Clear chunk from memory

        // Update progress
        const progress = Math.min(
          20 + Math.floor((processedCount / totalCount) * 60),
          80
        );
        this.broadcastProgress(
          exportId,
          progress,
          `Processed ${processedCount.toLocaleString()}/${totalCount.toLocaleString()} tasks`
        );
        await job.updateProgress(progress);

        // Force garbage collection if available
        if (global.gc) global.gc();
      }
    }

    // Write remaining items
    if (currentChunk.length > 0) {
      writeStream.write(currentChunk.join('\n') + '\n');
    }

    // TODO: The file should be moved to proper storage like S3 or Azure Blob Storage
    // ..........................................................................
    // TODO: The file should be deleted after it is moved to the proper storage
    // ..........................................................................

    // Close stream and wait for finish
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * Stream tasks to JSON file
   * @param {Object} filters - Export filters
   * @param {string} filePath - Output file path
   * @param {number} totalCount - Total number of tasks
   * @param {Object} job - BullMQ job instance
   * @param {string} exportId - Export ID
   */
  async streamToJSON(filters, filePath, totalCount, job, exportId) {
    const writeStream = createWriteStream(filePath);

    // Write JSON opening
    writeStream.write('{\n');
    writeStream.write(`  "exportedAt": "${new Date().toISOString()}",\n`);
    writeStream.write(`  "totalTasks": ${totalCount},\n`);
    writeStream.write('  "tasks": [\n');

    const sort = { createdAt: -1 };
    if (filters.sortBy && filters.sortOrder) {
      sort[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
    }
    // Optimize cursor with projection and batch size
    const cursor = Task.find(buildQueryFromFilters(filters))
      .lean()
      .sort(sort)
      .cursor({ batchSize: CHUNK_SIZE });

    let processedCount = 0;
    let isFirstRecord = true;
    let currentChunk = [];

    for await (const task of cursor) {
      const formattedTask = formatTaskForExport(task);

      // Add comma before record (except first)
      const jsonLine =
        (isFirstRecord ? '' : ',\n') + '    ' + JSON.stringify(formattedTask);
      currentChunk.push(jsonLine);

      processedCount++;
      isFirstRecord = false;

      // Write chunk when it reaches limit
      if (currentChunk.length >= CHUNK_SIZE) {
        writeStream.write(currentChunk.join(''));
        currentChunk = []; // Clear chunk from memory

        // Update progress
        const progress = Math.min(
          20 + Math.floor((processedCount / totalCount) * 60),
          80
        );
        this.broadcastProgress(
          exportId,
          progress,
          `Processed ${processedCount.toLocaleString()}/${totalCount.toLocaleString()} tasks`
        );
        await job.updateProgress(progress);

        // Force garbage collection if available
        if (global.gc) global.gc();
      }
    }

    // Write remaining items
    if (currentChunk.length > 0) {
      writeStream.write(currentChunk.join(''));
    }

    // Write JSON closing
    writeStream.write('\n  ]\n}');

    // TODO: The file should be moved to proper storage like S3 or Azure Blob Storage
    // ..........................................................................
    // TODO: The file should be deleted after it is moved to the proper storage
    // ..........................................................................

    // Close stream and wait for finish
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  /**
   * Broadcast progress update
   * @param {string} exportId - Export ID
   * @param {number} progress - Progress percentage
   * @param {string} message - Progress message
   */
  broadcastProgress(exportId, progress, message) {
    if (this.socketHandlers && this.socketHandlers.broadcastExportProgress) {
      this.socketHandlers.broadcastExportProgress(exportId, progress, message);
    }
  }

  /**
   * Broadcast completion
   * @param {string} exportId - Export ID
   * @param {Object} result - Export result
   */
  broadcastCompleted(exportId, result) {
    if (this.socketHandlers && this.socketHandlers.broadcastExportCompleted) {
      this.socketHandlers.broadcastExportCompleted(exportId, result);
    }
  }

  /**
   * Broadcast error
   * @param {string} exportId - Export ID
   * @param {string} error - Error message
   */
  broadcastError(exportId, error) {
    if (this.socketHandlers && this.socketHandlers.broadcastExportError) {
      this.socketHandlers.broadcastExportError(exportId, error);
    }
  }
}

export default ExportWorker;
