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

describe('Task Store Advanced Filtering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Date Range Filtering', () => {
    it('should handle created date range filters', async () => {
      const mockResponse = {
        data: {
          tasks: [{ _id: '1', title: 'Test Task' }],
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()
      taskStore.updateFilters({
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31'
      })

      expect(taskStore.filters.createdFrom).toBe('2024-01-01')
      expect(taskStore.filters.createdTo).toBe('2024-01-31')
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should handle completed date range filters', async () => {
      const mockResponse = {
        data: {
          tasks: [{ _id: '1', title: 'Test Task' }],
          pagination: { page: 1, limit: 10, total: 1, pages: 1 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()
      taskStore.updateFilters({
        completedFrom: '2024-01-15',
        completedTo: '2024-01-31'
      })

      expect(taskStore.filters.completedFrom).toBe('2024-01-15')
      expect(taskStore.filters.completedTo).toBe('2024-01-31')
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        completedFrom: '2024-01-15',
        completedTo: '2024-01-31',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should handle partial date ranges', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      // Only createdFrom
      taskStore.updateFilters({ createdFrom: '2024-01-01' })
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        createdFrom: '2024-01-01',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })

      // Only createdTo
      taskStore.updateFilters({ createdTo: '2024-01-31' })
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should exclude null date values from API calls', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      // Set some dates then clear them
      taskStore.filters.createdFrom = '2024-01-01'
      taskStore.filters.createdTo = null
      taskStore.filters.completedFrom = null
      taskStore.filters.completedTo = null

      await taskStore.fetchTasks()

      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        createdFrom: '2024-01-01',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })
  })

  describe('Filter Presets', () => {
    it('should have predefined filter presets', () => {
      const taskStore = useTaskStore()

      expect(taskStore.filterPresets).toHaveLength(4)
      expect(taskStore.filterPresets.map((p) => p.name)).toEqual([
        'Overdue Tasks',
        'This Week Completed',
        'High Priority Pending',
        'Recently Created'
      ])
    })

    it('should apply filter presets correctly', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()
      const highPriorityPreset = taskStore.filterPresets.find(
        (p) => p.name === 'High Priority Pending'
      )

      taskStore.applyFilterPreset(highPriorityPreset)

      expect(taskStore.filters.status).toEqual(['pending'])
      expect(taskStore.filters.priority).toEqual(['high'])
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: ['pending'],
        priority: ['high'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should reset page when applying presets', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()
      taskStore.pagination.page = 3

      const preset = taskStore.filterPresets[0]
      taskStore.applyFilterPreset(preset)

      expect(taskStore.pagination.page).toBe(1)
    })

    it('should apply date-based presets correctly', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()
      const recentlyCreatedPreset = taskStore.filterPresets.find(
        (p) => p.name === 'Recently Created'
      )

      taskStore.applyFilterPreset(recentlyCreatedPreset)

      expect(taskStore.filters.createdFrom).toBeTruthy()
      expect(taskStore.filters.sortBy).toBe('createdAt')
      expect(taskStore.filters.sortOrder).toBe('desc')
    })
  })

  describe('Active Filter Tracking', () => {
    it('should count active filters correctly', () => {
      const taskStore = useTaskStore()

      // No filters
      expect(taskStore.activeFilterCount).toBe(0)

      // Add status filter
      taskStore.filters.status = ['pending']
      expect(taskStore.activeFilterCount).toBe(1)

      // Add priority filter
      taskStore.filters.priority = ['high', 'medium']
      expect(taskStore.activeFilterCount).toBe(2)

      // Add date filters
      taskStore.filters.createdFrom = '2024-01-01'
      expect(taskStore.activeFilterCount).toBe(3)

      taskStore.filters.createdTo = '2024-01-31'
      expect(taskStore.activeFilterCount).toBe(4)

      taskStore.filters.completedFrom = '2024-01-15'
      expect(taskStore.activeFilterCount).toBe(5)

      taskStore.filters.completedTo = '2024-01-31'
      expect(taskStore.activeFilterCount).toBe(6)
    })

    it('should not count empty arrays or null values', () => {
      const taskStore = useTaskStore()

      taskStore.filters.status = []
      taskStore.filters.priority = []
      taskStore.filters.createdFrom = null
      taskStore.filters.createdTo = null

      expect(taskStore.activeFilterCount).toBe(0)
    })

    it('should generate active filter chips correctly', () => {
      const taskStore = useTaskStore()

      // Add various filters
      taskStore.filters.status = ['pending', 'completed']
      taskStore.filters.priority = ['high']
      taskStore.filters.createdFrom = '2024-01-01'
      taskStore.filters.createdTo = '2024-01-31'
      taskStore.filters.completedFrom = '2024-01-15'

      const chips = taskStore.activeFilterChips

      expect(chips).toHaveLength(4) // status, priority, created range, completed range

      // Check status chip
      const statusChip = chips.find((c) => c.key === 'status')
      expect(statusChip.label).toBe('Status: pending, completed')
      expect(statusChip.value).toEqual(['pending', 'completed'])

      // Check priority chip
      const priorityChip = chips.find((c) => c.key === 'priority')
      expect(priorityChip.label).toBe('Priority: high')
      expect(priorityChip.value).toEqual(['high'])

      // Check created date chip
      const createdChip = chips.find((c) => c.key === 'created')
      expect(createdChip.label).toContain('Created:')
      expect(createdChip.value).toEqual({
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31'
      })

      // Check completed date chip
      const completedChip = chips.find((c) => c.key === 'completed')
      expect(completedChip.label).toContain('Completed:')
      expect(completedChip.value).toEqual({
        completedFrom: '2024-01-15',
        completedTo: null
      })
    })
  })

  describe('Filter Management Methods', () => {
    it('should clear all filters correctly', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      // Set various filters
      taskStore.filters.status = ['pending']
      taskStore.filters.priority = ['high']
      taskStore.filters.createdFrom = '2024-01-01'
      taskStore.filters.completedTo = '2024-01-31'
      taskStore.pagination.page = 3

      taskStore.clearAllFilters()

      // Check all filters are reset
      expect(taskStore.filters.status).toEqual([])
      expect(taskStore.filters.priority).toEqual([])
      expect(taskStore.filters.createdFrom).toBeNull()
      expect(taskStore.filters.createdTo).toBeNull()
      expect(taskStore.filters.completedFrom).toBeNull()
      expect(taskStore.filters.completedTo).toBeNull()
      expect(taskStore.filters.sortBy).toBe('createdAt')
      expect(taskStore.filters.sortOrder).toBe('desc')
      expect(taskStore.pagination.page).toBe(1)

      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should remove individual filters correctly', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      // Set filters
      taskStore.filters.status = ['pending', 'completed']
      taskStore.filters.priority = ['high']
      taskStore.filters.createdFrom = '2024-01-01'
      taskStore.filters.createdTo = '2024-01-31'
      taskStore.filters.completedFrom = '2024-01-15'

      // Remove status filter
      taskStore.removeFilter('status')
      expect(taskStore.filters.status).toEqual([])
      expect(taskStore.filters.priority).toEqual(['high']) // Should remain

      // Remove created date range
      taskStore.removeFilter('created')
      expect(taskStore.filters.createdFrom).toBeNull()
      expect(taskStore.filters.createdTo).toBeNull()
      expect(taskStore.filters.completedFrom).toBe('2024-01-15') // Should remain

      // Remove priority filter
      taskStore.removeFilter('priority')
      expect(taskStore.filters.priority).toEqual([])

      // Remove completed date range
      taskStore.removeFilter('completed')
      expect(taskStore.filters.completedFrom).toBeNull()
      expect(taskStore.filters.completedTo).toBeNull()
    })

    it('should reset page when removing filters', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()
      taskStore.filters.status = ['pending']
      taskStore.pagination.page = 3

      taskStore.removeFilter('status')

      expect(taskStore.pagination.page).toBe(1)
    })
  })

  describe('Filter State Management', () => {
    it('should get current filter state', () => {
      const taskStore = useTaskStore()

      taskStore.filters.status = ['pending']
      taskStore.filters.priority = ['high']
      taskStore.filters.createdFrom = '2024-01-01'

      const state = taskStore.getFilterState()

      expect(state).toEqual({
        status: ['pending'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })

      // Should be a copy, not reference
      state.status.push('completed')
      expect(taskStore.filters.status).toEqual(['pending'])
    })

    it('should set filter state from external source', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      const newState = {
        status: ['completed'],
        priority: ['medium'],
        createdFrom: '2024-02-01',
        sortBy: 'title',
        sortOrder: 'asc'
      }

      taskStore.setFilterState(newState)

      expect(taskStore.filters.status).toEqual(['completed'])
      expect(taskStore.filters.priority).toEqual(['medium'])
      expect(taskStore.filters.createdFrom).toBe('2024-02-01')
      expect(taskStore.filters.sortBy).toBe('title')
      expect(taskStore.filters.sortOrder).toBe('asc')

      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: ['completed'],
        priority: ['medium'],
        createdFrom: '2024-02-01',
        sortBy: 'title',
        sortOrder: 'asc'
      })
    })
  })

  describe('Combined Advanced Filtering', () => {
    it('should handle complex filter combinations', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      taskStore.updateFilters({
        status: ['pending', 'in-progress'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15',
        sortBy: 'priority',
        sortOrder: 'asc'
      })

      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: ['pending', 'in-progress'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15',
        sortBy: 'priority',
        sortOrder: 'asc'
      })

      expect(taskStore.activeFilterCount).toBe(5)
      expect(taskStore.activeFilterChips).toHaveLength(4)
    })

    it('should maintain filter integrity during updates', async () => {
      const mockResponse = {
        data: {
          tasks: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 }
        }
      }
      apiClient.getTasks.mockResolvedValue(mockResponse)

      const taskStore = useTaskStore()

      // Set initial complex filters
      taskStore.updateFilters({
        status: ['pending'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        sortBy: 'title'
      })

      // Update only one filter
      taskStore.updateFilters({ status: ['completed'] })

      // Other filters should remain
      expect(taskStore.filters.status).toEqual(['completed'])
      expect(taskStore.filters.priority).toEqual(['high'])
      expect(taskStore.filters.createdFrom).toBe('2024-01-01')
      expect(taskStore.filters.sortBy).toBe('title')
    })
  })
})
