/**
 * @fileoverview Export formatting utilities
 * @module utils/exportFormatters
 */

/**
 * Formats date for export
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateForExport(date) {
  if (!date) return '';
  return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get default field selection for exports
 * @returns {Array} Default field names
 */
export function getDefaultFields() {
  return [
    'id',
    'title',
    'description',
    'status',
    'priority',
    'estimatedTime',
    'actualTime',
    'createdAt',
    'updatedAt',
    'completedAt'
  ];
}

/**
 * Build MongoDB query from filters
 * @param {Object} filters - Filter parameters
 * @returns {Object} MongoDB query object
 */
export function buildQueryFromFilters(filters) {
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
 * Format task data for export
 * @param {Object} task - Task document
 * @returns {Object} Formatted task data
 */
export function formatTaskForExport(task) {
  const newTask = {
    id: task._id ? task._id.toString() : task.id,
    title: task.title || '',
    description: task.description || '',
    status: task.status || '',
    priority: task.priority || '',
    estimatedTime: task.estimatedTime ?? 0,
    actualTime: task.actualTime ?? 0,
    createdAt: formatDateForExport(task.createdAt),
    updatedAt: formatDateForExport(task.updatedAt),
    completedAt: formatDateForExport(task.completedAt)
  };
  return newTask;
}

/**
 * Convert task object to CSV row
 * @param {Object} task - Formatted task object
 * @returns {string} CSV row
 */
export function taskToCsvRow(task) {
  return Object.values(task)
    .map((value) => {
      if (
        typeof value === 'string' &&
        (value.includes(',') || value.includes('"') || value.includes('\n'))
      ) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    })
    .join(',');
}

/**
 * Format chunks as CSV
 * @param {Array} chunks - Array of task chunks
 * @returns {string} CSV formatted string
 */
export function formatChunksAsCSV(chunks) {
  const headers = getDefaultFields();
  const csvHeaders = headers.join(',');

  let csvData = csvHeaders + '\n';

  for (const chunk of chunks) {
    for (const task of chunk) {
      csvData += taskToCsvRow(task) + '\n';
    }
  }
  return csvData;
}

/**
 * Format chunks as JSON
 * @param {Array} chunks - Array of task chunks
 * @param {number} totalTasks - Total number of tasks
 * @returns {string} JSON formatted string
 */
export function formatChunksAsJSON(chunks, totalTasks) {
  const tasks = [];

  for (const chunk of chunks) {
    tasks.push(...chunk);
  }

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalTasks,
      tasks
    },
    null,
    2
  );
}

/**
 * Generate cache key
 * @param {Object} filters - Filters
 * @param {string} format - Format
 * @returns {string} Cache key
 */
export function generateCacheKey(filters, format) {
  const filterString = JSON.stringify(filters, Object.keys(filters).sort());
  return `export:${Buffer.from(filterString + format).toString('base64')}`;
}

/**
 * Generate filename for export
 * @param {string} format - Export format
 * @param {Object} filters - Applied filters
 * @param {number} taskCount - Number of tasks
 * @returns {string} Generated filename
 */
export function generateFilename(format, filters, taskCount) {
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
 * Get MIME type for format
 * @param {string} format - Export format
 * @returns {string} MIME type
 */
export function getMimeType(format) {
  switch (format) {
  case 'csv':
    return 'text/csv';
  case 'json':
    return 'application/json';
  default:
    return 'application/octet-stream';
  }
}
