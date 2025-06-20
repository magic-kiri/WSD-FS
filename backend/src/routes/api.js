/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import Task, { TASK_STATUSES, TASK_PRIORITIES } from '../models/Task.js';
import AnalyticsService from '../services/analyticsService.js';
import exportsRouter, {
  setSocketHandlers as setExportsSocketHandlers
} from './exports.js';
import { redisClient } from '../config/redis.js';

const router = express.Router();

/**
 * Socket handlers reference for real-time updates
 * @type {Object|null}
 */
let socketHandlers = null;

/**
 * Valid sort fields based on Task schema
 * @constant {Array<string>}
 */
const VALID_SORT_FIELDS = Object.keys(Task.schema.paths).filter((field) =>
  // Include main fields that make sense for sorting
  [
    'title',
    'status',
    'priority',
    'createdAt',
    'updatedAt',
    'completedAt',
    'estimatedTime',
    'actualTime'
  ].includes(field)
);

/**
 * Valid sort orders
 * @constant {Array<string>}
 */
const VALID_SORT_ORDERS = ['asc', 'desc'];

/**
 * Sets socket handlers for broadcasting real-time updates
 * @param {Object} handlers - Socket handler object with broadcast methods
 * @example
 * setSocketHandlers(socketHandlers);
 */
export const setSocketHandlers = (handlers) => {
  socketHandlers = handlers;
  // Also set socket handlers for exports router
  setExportsSocketHandlers(handlers);
};

/**
 * Validates a date string more strictly than JavaScript's Date constructor
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if valid, false otherwise
 */
const isValidDate = (dateString) => {
  // Check format first
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);

  // Check if date is valid and matches the input
  if (isNaN(date.getTime())) {
    return false;
  }

  // Ensure the date components match the input (catches invalid dates like 2023-02-29)
  const [year, month, day] = dateString.split('-').map(Number);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 && // Month is 0-indexed
    date.getDate() === day
  );
};

/**
 * Validates enum values against allowed values
 * @param {Array|string} values - Values to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Object} Validation result with isValid and error properties
 */
const validateEnumValues = (values, allowedValues, fieldName) => {
  const valueArray = Array.isArray(values) ? values : [values];
  const invalidValues = valueArray.filter(
    (value) => !allowedValues.includes(value)
  );

  if (invalidValues.length > 0) {
    return {
      isValid: false,
      error: `Invalid ${fieldName} values: ${invalidValues.join(', ')}. Valid values: ${allowedValues.join(', ')}`
    };
  }

  return { isValid: true };
};

/**
 * Validates sort parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order (asc/desc)
 * @returns {Object} Validation result with isValid and error properties
 */
const validateSortParams = (sortBy, sortOrder) => {
  if (!VALID_SORT_FIELDS.includes(sortBy)) {
    return {
      isValid: false,
      error: `Invalid sortBy field: ${sortBy}. Valid fields: ${VALID_SORT_FIELDS.join(', ')}`
    };
  }

  if (!VALID_SORT_ORDERS.includes(sortOrder)) {
    return {
      isValid: false,
      error: `Invalid sortOrder: ${sortOrder}. Valid orders: ${VALID_SORT_ORDERS.join(', ')}`
    };
  }

  return { isValid: true };
};

/**
 * Creates MongoDB query for multi-select filtering
 * @param {Array|string} values - Values to filter by
 * @returns {Object|string} MongoDB query object or single value
 */
const createMultiSelectQuery = (values) => {
  const valueArray = Array.isArray(values) ? values : [values];
  return valueArray.length === 1 ? valueArray[0] : { $in: valueArray };
};

/**
 * GET /tasks - Retrieve tasks with pagination, filtering, and sorting
 * @name GetTasks
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of tasks per page
 * @param {string|Array} [req.query.status] - Filter by task status (supports multi-select)
 * @param {string|Array} [req.query.priority] - Filter by task priority (supports multi-select)
 * @param {string} [req.query.createdFrom] - Filter by task creation date range start
 * @param {string} [req.query.createdTo] - Filter by task creation date range end
 * @param {string} [req.query.completedFrom] - Filter by task completion date range start
 * @param {string} [req.query.completedTo] - Filter by task completion date range end
 * @param {string} [req.query.sortBy=createdAt] - Field to sort by
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc/desc)
 * @returns {Object} Paginated tasks with metadata
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      createdFrom,
      createdTo,
      completedFrom,
      completedTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Enhanced Status Filtering with reusable validation
    if (status) {
      const validation = validateEnumValues(status, TASK_STATUSES, 'status');
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      query.status = createMultiSelectQuery(status);
    }

    // Enhanced Priority Filtering with reusable validation
    if (priority) {
      const validation = validateEnumValues(
        priority,
        TASK_PRIORITIES,
        'priority'
      );
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      query.priority = createMultiSelectQuery(priority);
    }

    // Created Date Range Filtering
    if (createdFrom || createdTo) {
      query.createdAt = {};

      if (createdFrom) {
        if (!isValidDate(createdFrom)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid createdFrom date format. Use YYYY-MM-DD'
          });
        }
        const startDate = new Date(createdFrom);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }

      if (createdTo) {
        if (!isValidDate(createdTo)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid createdTo date format. Use YYYY-MM-DD'
          });
        }
        const endDate = new Date(createdTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Completed Date Range Filtering
    if (completedFrom || completedTo) {
      query.completedAt = { $exists: true, $ne: null };

      if (completedFrom) {
        if (!isValidDate(completedFrom)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid completedFrom date format. Use YYYY-MM-DD'
          });
        }
        const startDate = new Date(completedFrom);
        startDate.setHours(0, 0, 0, 0);
        query.completedAt.$gte = startDate;
      }

      if (completedTo) {
        if (!isValidDate(completedTo)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid completedTo date format. Use YYYY-MM-DD'
          });
        }
        const endDate = new Date(completedTo);
        endDate.setHours(23, 59, 59, 999);
        query.completedAt.$lte = endDate;
      }
    }

    // Sort validation
    const sortValidation = validateSortParams(sortBy, sortOrder);
    if (!sortValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: sortValidation.error
      });
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tasks = await Task.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tasks/:id - Retrieve a specific task by ID with Redis caching
 * @name GetTaskById
 * @function
 * @param {string} req.params.id - Task ID
 * @returns {Object} Task data or 404 if not found
 */
router.get('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `task:${id}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached)
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.setex(cacheKey, 300, JSON.stringify(task));

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /tasks - Create a new task
 * @name CreateTask
 * @function
 * @param {Object} req.body - Task data
 * @param {string} req.body.title - Task title (required)
 * @param {string} [req.body.description] - Task description
 * @param {string} [req.body.priority] - Task priority
 * @param {number} [req.body.estimatedTime] - Estimated completion time
 * @returns {Object} Created task with success message
 */
router.post('/tasks', async (req, res, next) => {
  try {
    const { title, description, priority, estimatedTime } = req.body;

    const task = new Task({
      title,
      description,
      priority,
      estimatedTime
    });

    await task.save();

    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('created', task);
    }

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /tasks/:id - Update an existing task
 * @name UpdateTask
 * @function
 * @param {string} req.params.id - Task ID to update
 * @param {Object} req.body - Updated task data
 * @returns {Object} Updated task data or 404 if not found
 */
router.put('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.del(`task:${id}`);
    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('updated', task);
    }

    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /tasks/:id - Delete a task by ID
 * @name DeleteTask
 * @function
 * @param {string} req.params.id - Task ID to delete
 * @returns {Object} Success message or 404 if not found
 */
router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.del(`task:${id}`);
    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('deleted', task);
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics - Retrieve comprehensive task analytics
 * @name GetAnalytics
 * @function
 * @returns {Object} Complete analytics data including metrics and charts
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const metrics = await AnalyticsService.getTaskMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /health - Health check endpoint
 * @name HealthCheck
 * @function
 * @returns {Object} API health status and timestamp
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Mount exports router
router.use('/exports', exportsRouter);

export default router;
