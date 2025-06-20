/**
 * @fileoverview Socket.IO event handlers for real-time communication
 * @module sockets/SocketHandlers
 */

import AnalyticsService from '../services/analyticsService.js';

/**
 * Handles Socket.IO connections and real-time events
 * @class SocketHandlers
 */
class SocketHandlers {
  /**
   * Creates SocketHandlers instance and sets up event listeners
   * @param {Object} io - Socket.IO server instance
   */
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  /**
   * Sets up Socket.IO event handlers for client connections
   * @private
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on('join-analytics', () => {
        socket.join('analytics');
        console.log(`📊 Client ${socket.id} joined analytics room`);
      });

      socket.on('join-exports', (exportId) => {
        if (exportId) {
          socket.join(`export-${exportId}`);
          console.log(`📥 Client ${socket.id} joined export room: ${exportId}`);
        }
      });

      socket.on('leave-exports', (exportId) => {
        if (exportId) {
          socket.leave(`export-${exportId}`);
          console.log(`📤 Client ${socket.id} left export room: ${exportId}`);
        }
      });

      socket.on('request-analytics', async () => {
        try {
          const metrics = await AnalyticsService.getTaskMetrics();
          socket.emit('analytics-update', metrics);
        } catch (error) {
          console.error('Error sending analytics update:', error);
          socket.emit('analytics-error', {
            message: 'Failed to get analytics data'
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcasts analytics updates to all connected clients in analytics room
   * @async
   * @returns {Promise<void>}
   */
  async broadcastAnalyticsUpdate() {
    try {
      const metrics = await AnalyticsService.getTaskMetrics();
      this.io.to('analytics').emit('analytics-update', metrics);
    } catch (error) {
      console.error('Error broadcasting analytics update:', error);
    }
  }

  /**
   * Broadcasts task updates to all connected clients
   * @param {string} action - Action performed (created, updated, deleted)
   * @param {Object} task - Task data
   */
  broadcastTaskUpdate(action, task) {
    this.io.emit('task-update', {
      action,
      task,
      timestamp: new Date().toISOString()
    });

    this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts export progress updates to clients monitoring specific export
   * @param {string} exportId - Export identifier
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} message - Progress message
   */
  broadcastExportProgress(exportId, progress, message) {
    this.io.to(`export-${exportId}`).emit('export-progress', {
      exportId,
      progress,
      message,
      timestamp: new Date().toISOString()
    });

    console.log(`📊 Export ${exportId}: ${progress}% - ${message}`);
  }

  /**
   * Broadcasts export completion notification
   * @param {string} exportId - Export identifier
   * @param {Object} result - Export result data
   */
  broadcastExportCompleted(exportId, result) {
    this.io.to(`export-${exportId}`).emit('export-completed', {
      exportId,
      result,
      timestamp: new Date().toISOString()
    });

    // Also broadcast general notification
    this.broadcastNotification(
      `✅ Export completed: ${result.taskCount} tasks in ${result.format.toUpperCase()} format`,
      'success'
    );

    console.log(`✅ Export ${exportId} completed: ${result.taskCount} tasks`);
  }

  /**
   * Broadcasts export error notification
   * @param {string} exportId - Export identifier
   * @param {string} errorMessage - Error message
   */
  broadcastExportError(exportId, errorMessage) {
    this.io.to(`export-${exportId}`).emit('export-error', {
      exportId,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });

    // Also broadcast general notification
    this.broadcastNotification(`❌ Export failed: ${errorMessage}`, 'error');

    console.error(`❌ Export ${exportId} failed: ${errorMessage}`);
  }

  /**
   * Broadcasts notifications to all connected clients
   * @param {string} message - Notification message
   * @param {string} [type='info'] - Notification type (info, success, warning, error)
   */
  broadcastNotification(message, type = 'info') {
    this.io.emit('notification', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Checks metrics against thresholds and sends notifications if exceeded
   * @async
   * @param {Object} metrics - Analytics metrics object
   * @returns {Promise<void>}
   */
  async checkMetricThresholds(metrics) {
    if (metrics.completionRate < 50) {
      this.broadcastNotification(
        `⚠️ Task completion rate has dropped to ${metrics.completionRate}%`,
        'warning'
      );
    }

    if (metrics.tasksByStatus.pending > 20) {
      this.broadcastNotification(
        `📋 High number of pending tasks: ${metrics.tasksByStatus.pending}`,
        'info'
      );
    }

    if (metrics.tasksByPriority.high > 10) {
      this.broadcastNotification(
        `🔥 High priority tasks need attention: ${metrics.tasksByPriority.high}`,
        'warning'
      );
    }
  }
}

export default SocketHandlers;
