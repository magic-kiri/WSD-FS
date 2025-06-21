/**
 * @fileoverview Worker startup script for export processing
 * @module workers/startWorkers
 */

import ExportWorker from './exportWorker.js';

/**
 * Global worker instances
 */
let exportWorker = null;

/**
 * Start all workers
 * @param {Object} socketHandlers - Socket handlers for real-time updates
 */
export const startWorkers = (socketHandlers = null) => {
  console.log('🔄 Starting export workers...');

  try {
    // Initialize export worker
    exportWorker = new ExportWorker(socketHandlers);
    exportWorker.start();

    console.log('✅ All export workers started successfully');
  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    throw error;
  }
};

/**
 * Stop all workers
 */
export const stopWorkers = async () => {
  console.log('🛑 Stopping export workers...');

  const promises = [];

  if (exportWorker) {
    promises.push(exportWorker.stop());
  }

  try {
    await Promise.all(promises);
    console.log('✅ All workers stopped successfully');
  } catch (error) {
    console.error('❌ Error stopping workers:', error);
  }
};

/**
 * Graceful shutdown handlers
 */
const gracefulShutdown = async (signal) => {
  console.log(`📝 Received ${signal}, shutting down workers...`);
  await stopWorkers();
  process.exit(0);
};

// Handle process termination
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception in worker:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, _promise) => {
  console.error('💥 Unhandled rejection in worker:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

export default {
  startWorkers,
  stopWorkers
};
