/**
 * @fileoverview BullMQ queue configuration for export processing
 * @module config/queue
 */

import { Queue } from 'bullmq';

/**
 * Redis connection configuration for BullMQ
 */
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
};

/**
 * Export processing queue
 */
export const exportQueue = new Queue('export-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 5000 // Start with 5 second delay
    },
    delay: 1000 // 1 second delay before starting
  }
});

/**
 * Job priorities
 */
export const JOB_PRIORITIES = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 15
};

/**
 * Job types
 */
export const JOB_TYPES = {
  EXPORT_TASKS: 'export-tasks',
  CLEANUP_EXPORTS: 'cleanup-exports'
};

/**
 * Add export job to queue
 * @param {Object} jobData - Export job data
 * @param {Object} options - Job options
 * @returns {Promise<Object>} Job instance
 */
export const addExportJob = async (jobData, options = {}) => {
  const jobOptions = {
    priority: JOB_PRIORITIES.NORMAL,
    ...options
  };

  return await exportQueue.add(JOB_TYPES.EXPORT_TASKS, jobData, jobOptions);
};

/**
 * Get job status and progress
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job status
 */
export const getJobStatus = async (jobId) => {
  const job = await exportQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    progress: job.progress,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    timestamp: job.timestamp,
    opts: job.opts,
    returnvalue: job.returnvalue
  };
};

/**
 * Cancel/remove a job
 * @param {string} jobId - Job ID
 * @returns {Promise<void>}
 */
export const cancelJob = async (jobId) => {
  const job = await exportQueue.getJob(jobId);
  if (job) {
    await job.remove();
  }
};

/**
 * Clean up old jobs
 * @returns {Promise<void>}
 */
export const cleanOldJobs = async () => {
  await exportQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'); // 24 hours
  await exportQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'); // 7 days
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📦 Closing export queue...');
  await exportQueue.close();
});

process.on('SIGINT', async () => {
  console.log('📦 Closing export queue...');
  await exportQueue.close();
});
