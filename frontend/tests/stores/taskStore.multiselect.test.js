import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../../src/stores/taskStore.js'
import apiClient from '../../src/api/client.js'

// Mock the API client
vi.mock('../../src/api/client.js', () => ({
  default: {
    getTasks: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn()
  }
}))

// Mock the socket
vi.mock('../../src/plugins/socket.js', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

describe('Task Store Multi-Select Filter Functionality', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize filters with empty arrays for status and priority', () => {
    const taskStore = useTaskStore()

    expect(taskStore.filters.status).toEqual([])
    expect(taskStore.filters.priority).toEqual([])
    expect(taskStore.filters.sortBy).toBe('createdAt')
    expect(taskStore.filters.sortOrder).toBe('desc')
  })

  it('should handle single status filter correctly', async () => {
    const mockResponse = {
      data: {
        tasks: [{ _id: '1', status: 'pending' }],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()
    taskStore.updateFilters({ status: ['pending'] })

    expect(taskStore.filters.status).toEqual(['pending'])
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: ['pending'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should handle multiple status filters correctly', async () => {
    const mockResponse = {
      data: {
        tasks: [
          { _id: '1', status: 'pending' },
          { _id: '2', status: 'completed' }
        ],
        pagination: { page: 1, limit: 10, total: 2, pages: 1 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()
    taskStore.updateFilters({ status: ['pending', 'completed'] })

    expect(taskStore.filters.status).toEqual(['pending', 'completed'])
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: ['pending', 'completed'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should handle multiple priority filters correctly', async () => {
    const mockResponse = {
      data: {
        tasks: [
          { _id: '1', priority: 'high' },
          { _id: '2', priority: 'medium' }
        ],
        pagination: { page: 1, limit: 10, total: 2, pages: 1 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()
    taskStore.updateFilters({ priority: ['high', 'medium'] })

    expect(taskStore.filters.priority).toEqual(['high', 'medium'])
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      priority: ['high', 'medium'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should handle combined status and priority filters', async () => {
    const mockResponse = {
      data: {
        tasks: [
          { _id: '1', status: 'pending', priority: 'high' },
          { _id: '2', status: 'in-progress', priority: 'medium' }
        ],
        pagination: { page: 1, limit: 10, total: 2, pages: 1 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()
    taskStore.updateFilters({
      status: ['pending', 'in-progress'],
      priority: ['high', 'medium']
    })

    expect(taskStore.filters.status).toEqual(['pending', 'in-progress'])
    expect(taskStore.filters.priority).toEqual(['high', 'medium'])
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: ['pending', 'in-progress'],
      priority: ['high', 'medium'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should clean up empty arrays in fetchTasks', async () => {
    const mockResponse = {
      data: {
        tasks: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()

    // Set empty arrays
    taskStore.filters.status = []
    taskStore.filters.priority = []

    await taskStore.fetchTasks()

    // Should not include empty arrays in the API call
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should preserve non-empty arrays in fetchTasks', async () => {
    const mockResponse = {
      data: {
        tasks: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()

    // Set some filters
    taskStore.filters.status = ['pending']
    taskStore.filters.priority = []

    await taskStore.fetchTasks()

    // Should include non-empty arrays but exclude empty ones
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: ['pending'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should reset page to 1 when updating filters', async () => {
    const mockResponse = {
      data: {
        tasks: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()

    // Set page to something other than 1
    taskStore.pagination.page = 3

    // Update filters
    taskStore.updateFilters({ status: ['pending'] })

    // Page should be reset to 1
    expect(taskStore.pagination.page).toBe(1)
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: ['pending'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should maintain existing filters when updating partial filters', async () => {
    const mockResponse = {
      data: {
        tasks: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()

    // Set initial filters
    taskStore.filters.status = ['pending']
    taskStore.filters.priority = ['high']
    taskStore.filters.sortBy = 'title'

    // Update only status
    taskStore.updateFilters({ status: ['pending', 'completed'] })

    // Should maintain other filters
    expect(taskStore.filters.status).toEqual(['pending', 'completed'])
    expect(taskStore.filters.priority).toEqual(['high'])
    expect(taskStore.filters.sortBy).toBe('title')
  })

  it('should handle filter clearing correctly', async () => {
    const mockResponse = {
      data: {
        tasks: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()

    // Set initial filters
    taskStore.filters.status = ['pending', 'completed']
    taskStore.filters.priority = ['high', 'medium']

    // Clear filters by setting to empty arrays
    taskStore.updateFilters({
      status: [],
      priority: []
    })

    expect(taskStore.filters.status).toEqual([])
    expect(taskStore.filters.priority).toEqual([])

    // API should be called without the cleared filters
    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  it('should handle real-world filter scenario', async () => {
    const mockResponse = {
      data: {
        tasks: [
          {
            _id: '1',
            status: 'pending',
            priority: 'high',
            title: 'Urgent task'
          },
          {
            _id: '2',
            status: 'in-progress',
            priority: 'high',
            title: 'Important task'
          },
          {
            _id: '3',
            status: 'pending',
            priority: 'medium',
            title: 'Normal task'
          }
        ],
        pagination: { page: 1, limit: 10, total: 3, pages: 1 }
      }
    }
    apiClient.getTasks.mockResolvedValue(mockResponse)

    const taskStore = useTaskStore()

    // Simulate user selecting:
    // - Multiple statuses: pending, in-progress
    // - Multiple priorities: high, medium
    // - Sorting by priority
    taskStore.updateFilters({
      status: ['pending', 'in-progress'],
      priority: ['high', 'medium'],
      sortBy: 'priority',
      sortOrder: 'desc'
    })

    expect(taskStore.filters).toEqual({
      status: ['pending', 'in-progress'],
      priority: ['high', 'medium'],
      sortBy: 'priority',
      sortOrder: 'desc'
    })

    expect(apiClient.getTasks).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      status: ['pending', 'in-progress'],
      priority: ['high', 'medium'],
      sortBy: 'priority',
      sortOrder: 'desc'
    })

    // Wait for the async operation to complete
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(taskStore.tasks).toHaveLength(3)
  })
})
