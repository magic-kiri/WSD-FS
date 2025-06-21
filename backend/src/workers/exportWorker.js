/**
 * @fileoverview Export worker for processing export jobs with streaming and chunked processing
 * @module workers/exportWorker
 */

import { Worker } from 'bullmq';
import Task from '../models/Task.js';
import ExportHistory from '../models/ExportHistory.js';
import { redisClient } from '../config/redis.js';
import { exportQueue } from '../config/queue.js';
import {
  buildQueryFromFilters,
  formatTaskForExport,
  formatChunksAsCSV,
  formatChunksAsJSON,
  generateCacheKey
} from '../utils/exportFormatters.js';

/**
 * Chunk size for processing (records per batch)
 */
const CHUNK_SIZE = 10000;

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

      // Process with streaming and chunked processing
      const result = await this.processWithChunkedStreaming({
        exportId,
        filters,
        format,
        totalCount,
        job
      });

      // Cache the result
      const cacheKey = generateCacheKey(filters, format);
      const cacheData = {
        data: result.formattedData,
        size: result.fileSize,
        taskCount: result.recordCount,
        format,
        createdAt: new Date().toISOString()
      };

      await redisClient.setex(cacheKey, 30 * 60, JSON.stringify(cacheData));
      // Update export history
      await ExportHistory.findOneAndUpdate(
        { exportId },
        {
          status: 'completed',
          fileSize: result.fileSize,
          taskCount: result.recordCount,
          completedAt: new Date()
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
        data: result.formattedData
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
   * Process export with streaming and chunked processing in memory
   * @param {Object} params - Processing parameters
   * @returns {Promise<Object>} Processing result
   */
  async processWithChunkedStreaming({
    exportId,
    filters,
    format,
    totalCount,
    job
  }) {
    let processedCount = 0;
    const chunks = [];

    this.broadcastProgress(exportId, 20, 'Processing data in chunks...');
    await job.updateProgress(20);
    const sort = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = filters.sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    // Process in chunks using cursor for memory efficiency
    const cursor = Task.find(buildQueryFromFilters(filters))
      .sort(sort)
      .lean() // Only fetch raw document data, not full Mongoose documents
      .cursor();

    let currentChunk = [];

    for await (const task of cursor) {
      const formattedTask = formatTaskForExport(task);
      currentChunk.push(formattedTask);
      processedCount++;

      // Process chunk when it reaches the limit
      if (currentChunk.length >= CHUNK_SIZE) {
        chunks.push([...currentChunk]);
        currentChunk = [];

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

        // Allow garbage collection between chunks
        if (global.gc) {
          global.gc();
        }
      }
    }

    // Add remaining items
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    this.broadcastProgress(exportId, 85, 'Formatting export data...');
    await job.updateProgress(85);

    // Format data based on export format
    let formattedData;
    if (format === 'csv') {
      formattedData = formatChunksAsCSV(chunks);
    } else if (format === 'json') {
      formattedData = formatChunksAsJSON(chunks, processedCount);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    const fileSize = Buffer.byteLength(formattedData, 'utf8');

    this.broadcastProgress(exportId, 95, 'Finalizing export...');
    await job.updateProgress(95);

    return {
      recordCount: processedCount,
      fileSize,
      formattedData
    };
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
