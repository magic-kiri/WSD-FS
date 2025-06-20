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
 * Prepares task data for export
 * @param {Array} tasks - Array of task documents
 * @returns {Array} Array of formatted task objects
 */
export function prepareTaskData(tasks) {
  return tasks.map((task) => ({
    id: task._id.toString(),
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    estimatedTime: task.estimatedTime || 0,
    actualTime: task.actualTime || 0,
    createdAt: formatDateForExport(task.createdAt),
    updatedAt: formatDateForExport(task.updatedAt),
    completedAt: task.completedAt ? formatDateForExport(task.completedAt) : ''
  }));
}

/**
 * Converts task data to CSV format
 * @param {Array} taskData - Formatted task data
 * @returns {string} CSV formatted string
 */
export function formatAsCSV(taskData) {
  if (taskData.length === 0) return '';

  const headers = Object.keys(taskData[0]);
  const csvHeaders = headers.join(',');

  const csvRows = taskData.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"') || value.includes('\n'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Converts task data to JSON format
 * @param {Array} taskData - Formatted task data
 * @returns {string} JSON formatted string
 */
export function formatAsJSON(taskData) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalTasks: taskData.length,
      tasks: taskData
    },
    null,
    2
  );
}
