/**
 * @fileoverview Task enum constants for frontend components
 * @module constants/taskEnums
 */

/**
 * Task status enum values
 * @constant {Array<string>}
 */
export const TASK_STATUSES = ['pending', 'in-progress', 'completed']

/**
 * Task priority enum values
 * @constant {Array<string>}
 */
export const TASK_PRIORITIES = ['low', 'medium', 'high']

/**
 * Status options for UI components
 * @constant {Array<Object>}
 */
export const STATUS_OPTIONS = [
  { title: 'Pending', value: 'pending' },
  { title: 'In Progress', value: 'in-progress' },
  { title: 'Completed', value: 'completed' }
]

/**
 * Priority options for UI components
 * @constant {Array<Object>}
 */
export const PRIORITY_OPTIONS = [
  { title: 'Low', value: 'low' },
  { title: 'Medium', value: 'medium' },
  { title: 'High', value: 'high' }
]
