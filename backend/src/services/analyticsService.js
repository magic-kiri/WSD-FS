/**
 * @fileoverview Analytics service for task metrics calculation and caching
 * @module services/AnalyticsService
 */

import Task from '../models/Task.js';
import { redisClient } from '../config/redis.js';

/**
 * Service class for calculating and caching task analytics
 * @class AnalyticsService
 */
class AnalyticsService {
  /**
   * Retrieves task metrics with Redis caching
   * @static
   * @async
   * @returns {Promise<Object>} Complete task metrics object
   * @throws {Error} Falls back to direct calculation if cache fails
   * @example
   * const metrics = await AnalyticsService.getTaskMetrics();
   * console.log(metrics.totalTasks, metrics.completionRate);
   */
  static async getTaskMetrics() {
    try {
      const cacheKey = 'task_metrics';
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const metrics = await this.calculateMetrics();

      await redisClient.setex(cacheKey, 10, JSON.stringify(metrics));

      return metrics;
    } catch (error) {
      console.error('Error getting task metrics:', error);
      return await this.calculateMetrics();
    }
  }

  /**
   * Calculates all task metrics from database
   * @static
   * @async
   * @returns {Promise<Object>} Comprehensive metrics object with all analytics data
   */
  static async calculateMetrics() {
    const [
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      completionRate,
      averageCompletionTime,
      tasksCreatedToday,
      tasksCompletedToday,
      recentActivity,
      exportMetrics,
      unifiedActivity
    ] = await Promise.all([
      Task.countDocuments(),
      this.getTasksByStatus(),
      this.getTasksByPriority(),
      this.getCompletionRate(),
      this.getAverageCompletionTime(),
      this.getTasksCreatedToday(),
      this.getTasksCompletedToday(),
      this.getRecentActivity(),
      this.getExportMetrics(),
      this.getUnifiedActivity()
    ]);

    return {
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      completionRate,
      averageCompletionTime,
      tasksCreatedToday,
      tasksCompletedToday,
      recentActivity,
      exportMetrics,
      unifiedActivity,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Groups tasks by status and returns count for each status
   * @static
   * @async
   * @returns {Promise<Object>} Object with pending, in-progress, and completed counts
   */
  static async getTasksByStatus() {
    const result = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const statusCounts = { pending: 0, 'in-progress': 0, completed: 0 };
    result.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    return statusCounts;
  }

  /**
   * Groups tasks by priority and returns count for each priority level
   * @static
   * @async
   * @returns {Promise<Object>} Object with low, medium, and high priority counts
   */
  static async getTasksByPriority() {
    const result = await Task.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const priorityCounts = { low: 0, medium: 0, high: 0 };
    result.forEach((item) => {
      priorityCounts[item._id] = item.count;
    });

    return priorityCounts;
  }

  /**
   * Calculates task completion rate as percentage
   * @static
   * @async
   * @returns {Promise<number>} Completion rate percentage (0-100)
   */
  static async getCompletionRate() {
    const [total, completed] = await Promise.all([
      Task.countDocuments(),
      Task.countDocuments({ status: 'completed' })
    ]);

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  /**
   * Calculates average time to complete tasks in hours
   * @static
   * @async
   * @returns {Promise<number>} Average completion time in hours (rounded to 1 decimal)
   */
  static async getAverageCompletionTime() {
    const completedTasks = await Task.find({
      status: 'completed',
      completedAt: { $exists: true, $ne: null }
    }).select('createdAt completedAt');

    if (completedTasks.length === 0) return 0;

    // Filter out invalid tasks and calculate valid completion times
    const validCompletionTimes = [];

    for (const task of completedTasks) {
      if (task.completedAt && task.createdAt) {
        const completionTime =
          task.completedAt.getTime() - task.createdAt.getTime();

        // Only include positive completion times (completed after created)
        if (completionTime > 0) {
          validCompletionTimes.push(completionTime);
        }
      }
    }

    if (validCompletionTimes.length === 0) return 0;

    const averageMilliseconds =
      validCompletionTimes.reduce((sum, time) => sum + time, 0) /
      validCompletionTimes.length;

    // Convert to hours and round to 1 decimal place
    return Math.round((averageMilliseconds / (1000 * 60 * 60)) * 10) / 10;
  }

  /**
   * Counts tasks created today (since midnight)
   * @static
   * @async
   * @returns {Promise<number>} Number of tasks created today
   */
  static async getTasksCreatedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await Task.countDocuments({
      createdAt: { $gte: today }
    });
  }

  /**
   * Counts tasks completed today (since midnight)
   * @static
   * @async
   * @returns {Promise<number>} Number of tasks completed today
   */
  static async getTasksCompletedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await Task.countDocuments({
      status: 'completed',
      completedAt: { $gte: today }
    });
  }

  /**
   * Retrieves most recently updated tasks for activity feed
   * @static
   * @async
   * @returns {Promise<Array>} Array of 10 most recent tasks with basic info
   */
  static async getRecentActivity() {
    return await Task.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('title status priority updatedAt');
  }

  /**
   * Calculates average task creation rate over last 30 days
   * @static
   * @async
   * @returns {Promise<number>} Average tasks created per hour over 30 days
   */
  static async getTaskCreationRate() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Task.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    return result.length > 0
      ? result.reduce((sum, item) => sum + item.count, 0) / result.length
      : 0;
  }

  /**
   * Invalidates the Redis cache for task metrics
   * @static
   * @async
   * @returns {Promise<void>}
   */
  static async invalidateCache() {
    try {
      await redisClient.del('task_metrics');
    } catch (error) {
      console.error('Error invalidating analytics cache:', error);
    }
  }

  /**
   * Data migration utility to fix completed tasks missing completedAt dates
   * @static
   * @async
   * @returns {Promise<void>} Logs number of fixed tasks
   */
  static async fixCompletedTasksData() {
    try {
      // Fix completed tasks that don't have completedAt set
      const completedTasksWithoutDate = await Task.find({
        status: 'completed',
        $or: [{ completedAt: { $exists: false } }, { completedAt: null }]
      });

      for (const task of completedTasksWithoutDate) {
        // Use updatedAt as completedAt if it's available and makes sense
        if (task.updatedAt && task.updatedAt >= task.createdAt) {
          task.completedAt = task.updatedAt;
          await task.save();
          console.log(`Fixed completedAt for task ${task._id}`);
        }
      }

      console.log(`Fixed ${completedTasksWithoutDate.length} completed tasks`);
    } catch (error) {
      console.error('Error fixing completed tasks data:', error);
    }
  }

  /**
   * Gets export-related metrics for dashboard integration
   * @static
   * @async
   * @returns {Promise<Object>} Export metrics including total exports, success rate, etc.
   */
  static async getExportMetrics() {
    try {
      const ExportHistory = (await import('../models/ExportHistory.js'))
        .default;

      const [
        totalExports,
        completedExports,
        failedExports,
        todayExports,
        recentExports
      ] = await Promise.all([
        ExportHistory.countDocuments(),
        ExportHistory.countDocuments({ status: 'completed' }),
        ExportHistory.countDocuments({ status: 'failed' }),
        this.getExportsCreatedToday(),
        this.getRecentExportActivity()
      ]);

      const successRate =
        totalExports > 0
          ? Math.round((completedExports / totalExports) * 100)
          : 0;

      return {
        totalExports,
        completedExports,
        failedExports,
        successRate,
        todayExports,
        recentExports
      };
    } catch (error) {
      console.error('Error getting export metrics:', error);
      return {
        totalExports: 0,
        completedExports: 0,
        failedExports: 0,
        successRate: 0,
        todayExports: 0,
        recentExports: []
      };
    }
  }

  /**
   * Counts exports created today (since midnight)
   * @static
   * @async
   * @returns {Promise<number>} Number of exports created today
   */
  static async getExportsCreatedToday() {
    try {
      const ExportHistory = (await import('../models/ExportHistory.js'))
        .default;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return await ExportHistory.countDocuments({
        createdAt: { $gte: today }
      });
    } catch (error) {
      console.error('Error getting exports created today:', error);
      return 0;
    }
  }

  /**
   * Gets recent export activity for dashboard
   * @static
   * @async
   * @returns {Promise<Array>} Array of recent exports with basic info
   */
  static async getRecentExportActivity() {
    try {
      const ExportHistory = (await import('../models/ExportHistory.js'))
        .default;

      return await ExportHistory.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .select('exportId format status createdAt taskCount fileSize');
    } catch (error) {
      console.error('Error getting recent export activity:', error);
      return [];
    }
  }

  /**
   * Gets unified activity feed combining task and export activities
   * @static
   * @async
   * @returns {Promise<Array>} Array of unified activity items sorted by timestamp
   */
  static async getUnifiedActivity() {
    try {
      // Get recent task activities
      const taskActivities = await Task.find()
        .sort({ updatedAt: -1 })
        .limit(8)
        .select('title status priority updatedAt createdAt');

      // Get recent export activities
      const ExportHistory = (await import('../models/ExportHistory.js'))
        .default;
      const exportActivities = await ExportHistory.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('exportId format status createdAt taskCount fileSize');

      // Transform task activities
      const transformedTasks = taskActivities.map((task) => ({
        id: task._id,
        type: 'task',
        action: this.getTaskAction(task),
        title: task.title,
        subtitle: `Priority: ${task.priority}`,
        timestamp: task.updatedAt,
        status: task.status,
        priority: task.priority,
        icon: this.getTaskIcon(task.status),
        color: this.getTaskColor(task.status),
        actionable: false
      }));

      // Transform export activities
      const transformedExports = exportActivities.map((exportItem) => ({
        id: exportItem.exportId,
        type: 'export',
        action: this.getExportAction(exportItem.status),
        title: `${exportItem.format?.toUpperCase()} Export`,
        subtitle: exportItem.taskCount
          ? `${exportItem.taskCount.toLocaleString()} tasks`
          : 'Export data',
        timestamp: exportItem.createdAt,
        status: exportItem.status,
        format: exportItem.format,
        icon: this.getExportIcon(exportItem.format, exportItem.status),
        color: this.getExportColor(exportItem.status),
        actionable:
          exportItem.status === 'completed' || exportItem.status === 'failed',
        exportId: exportItem.exportId,
        fileSize: exportItem.fileSize
      }));

      // Combine and sort by timestamp
      const allActivities = [...transformedTasks, ...transformedExports];
      allActivities.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Return top 10 most recent activities
      return allActivities.slice(0, 10);
    } catch (error) {
      console.error('Error getting unified activity:', error);
      return [];
    }
  }

  /**
   * Helper method to determine task action based on status and timestamps
   * @static
   * @param {Object} task - Task object
   * @returns {string} Action description
   */
  static getTaskAction(task) {
    const timeDiff = task.updatedAt - task.createdAt;
    const isNewlyCreated = timeDiff < 60000; // Less than 1 minute

    if (isNewlyCreated) return 'created';

    switch (task.status) {
      case 'pending':
        return 'updated';
      case 'in-progress':
        return 'started';
      case 'completed':
        return 'completed';
      default:
        return 'updated';
    }
  }

  /**
   * Helper method to get export action based on status
   * @static
   * @param {string} status - Export status
   * @returns {string} Action description
   */
  static getExportAction(status) {
    switch (status) {
      case 'pending':
        return 'started';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'created';
    }
  }

  /**
   * Helper method to get task icon
   * @static
   * @param {string} status - Task status
   * @returns {string} Material Design icon name
   */
  static getTaskIcon(status) {
    switch (status) {
      case 'pending':
        return 'mdi-clock-outline';
      case 'in-progress':
        return 'mdi-progress-clock';
      case 'completed':
        return 'mdi-check-circle';
      default:
        return 'mdi-format-list-checks';
    }
  }

  /**
   * Helper method to get export icon
   * @static
   * @param {string} format - Export format
   * @param {string} status - Export status
   * @returns {string} Material Design icon name
   */
  static getExportIcon(format, status) {
    if (status === 'failed') return 'mdi-alert-circle';
    if (status === 'completed') return 'mdi-download-circle';
    if (status === 'processing') return 'mdi-cog';

    return format === 'csv' ? 'mdi-file-delimited' : 'mdi-code-json';
  }

  /**
   * Helper method to get task color
   * @static
   * @param {string} status - Task status
   * @returns {string} Vuetify color name
   */
  static getTaskColor(status) {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'in-progress':
        return 'info';
      case 'completed':
        return 'success';
      default:
        return 'grey';
    }
  }

  /**
   * Helper method to get export color
   * @static
   * @param {string} status - Export status
   * @returns {string} Vuetify color name
   */
  static getExportColor(status) {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'processing':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'secondary';
    }
  }
}

export default AnalyticsService;
