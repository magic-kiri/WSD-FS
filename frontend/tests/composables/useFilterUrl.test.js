import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFilterUrl } from '../../src/composables/useFilterUrl.js'

// Mock Vue Router
const mockPush = vi.fn(() => Promise.resolve())
const mockRoute = {
  path: '/tasks',
  query: {}
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(() => Promise.resolve())
  }),
  useRoute: () => mockRoute
}))

// Mock the task store
const mockTaskStore = {
  filters: {
    status: [],
    priority: [],
    createdFrom: null,
    createdTo: null,
    completedFrom: null,
    completedTo: null,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  },
  setFilterState: vi.fn()
}

vi.mock('../../src/stores/taskStore.js', () => ({
  useTaskStore: () => mockTaskStore
}))

describe('useFilterUrl Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Reset mock route
    mockRoute.query = {}
    mockTaskStore.pagination.page = 1

    // Reset filters
    Object.assign(mockTaskStore.filters, {
      status: [],
      priority: [],
      createdFrom: null,
      createdTo: null,
      completedFrom: null,
      completedTo: null,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })

  describe('Filter Serialization', () => {
    it('should serialize basic filters to URL parameters', () => {
      const { serializeFilters } = useFilterUrl()

      const filters = {
        status: ['pending', 'completed'],
        priority: ['high'],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const result = serializeFilters(filters)

      expect(result).toEqual({
        status: 'pending,completed',
        priority: 'high'
      })
    })

    it('should serialize date range filters', () => {
      const { serializeFilters } = useFilterUrl()

      const filters = {
        status: [],
        priority: [],
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15',
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const result = serializeFilters(filters)

      expect(result).toEqual({
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15'
      })
    })

    it('should serialize non-default sorting', () => {
      const { serializeFilters } = useFilterUrl()

      const filters = {
        status: [],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'title',
        sortOrder: 'asc'
      }

      const result = serializeFilters(filters)

      expect(result).toEqual({
        sortBy: 'title',
        sortOrder: 'asc'
      })
    })

    it('should include pagination when page > 1', () => {
      const { serializeFilters } = useFilterUrl()
      mockTaskStore.pagination.page = 3

      const filters = {
        status: ['pending'],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const result = serializeFilters(filters)

      expect(result).toEqual({
        status: 'pending',
        page: '3'
      })
    })

    it('should exclude empty arrays and null values', () => {
      const { serializeFilters } = useFilterUrl()

      const filters = {
        status: [],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const result = serializeFilters(filters)

      expect(result).toEqual({})
    })
  })

  describe('Filter Deserialization', () => {
    it('should deserialize basic URL parameters to filters', () => {
      const { deserializeFilters } = useFilterUrl()

      const query = {
        status: 'pending,completed',
        priority: 'high,medium'
      }

      const result = deserializeFilters(query)

      expect(result).toEqual({
        status: ['pending', 'completed'],
        priority: ['high', 'medium'],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should deserialize date parameters', () => {
      const { deserializeFilters } = useFilterUrl()

      const query = {
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15'
      }

      const result = deserializeFilters(query)

      expect(result.createdFrom).toBe('2024-01-01')
      expect(result.createdTo).toBe('2024-01-31')
      expect(result.completedFrom).toBe('2024-01-15')
      expect(result.completedTo).toBeNull()
    })

    it('should deserialize sorting parameters', () => {
      const { deserializeFilters } = useFilterUrl()

      const query = {
        sortBy: 'priority',
        sortOrder: 'asc'
      }

      const result = deserializeFilters(query)

      expect(result.sortBy).toBe('priority')
      expect(result.sortOrder).toBe('asc')
    })

    it('should handle empty query parameters', () => {
      const { deserializeFilters } = useFilterUrl()

      const query = {}

      const result = deserializeFilters(query)

      expect(result).toEqual({
        status: [],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should filter out empty strings from arrays', () => {
      const { deserializeFilters } = useFilterUrl()

      const query = {
        status: 'pending,,completed',
        priority: 'high,'
      }

      const result = deserializeFilters(query)

      expect(result.status).toEqual(['pending', 'completed'])
      expect(result.priority).toEqual(['high'])
    })
  })

  describe('URL Updates', () => {
    it('should update URL when filters change', () => {
      const { updateUrl, initializeFromUrl } = useFilterUrl()

      const filters = {
        status: ['pending'],
        priority: ['high'],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      // Properly initialize the composable
      initializeFromUrl()
      mockTaskStore.filters = filters

      updateUrl(filters)

      expect(mockPush).toHaveBeenCalledWith({
        path: '/tasks',
        query: {
          status: 'pending',
          priority: 'high'
        }
      })
    })

    it('should not update URL if not initialized', () => {
      const { updateUrl } = useFilterUrl()

      const filters = {
        status: ['pending'],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      updateUrl(filters)

      expect(mockPush).not.toHaveBeenCalled()
    })
    it('should not update URL if query has not changed', () => {
      const { updateUrl } = useFilterUrl()

      // Set current query to match what we're about to set
      mockRoute.query = { status: 'pending' }

      const filters = {
        status: ['pending'],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      // Simulate initialization
      mockTaskStore.filters = filters

      updateUrl(filters)

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('URL Initialization', () => {
    it('should initialize filters from URL parameters', () => {
      const { initializeFromUrl } = useFilterUrl()

      mockRoute.query = {
        status: 'pending,completed',
        priority: 'high',
        createdFrom: '2024-01-01',
        sortBy: 'title',
        page: '2'
      }

      initializeFromUrl()

      expect(mockTaskStore.setFilterState).toHaveBeenCalledWith({
        status: ['pending', 'completed'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'title',
        sortOrder: 'desc'
      })

      expect(mockTaskStore.pagination.page).toBe(2)
    })

    it('should handle invalid page numbers', () => {
      const { initializeFromUrl } = useFilterUrl()

      mockRoute.query = {
        status: 'pending',
        page: 'invalid'
      }

      initializeFromUrl()

      expect(mockTaskStore.pagination.page).toBe(1) // Should remain default
    })

    it('should handle negative page numbers', () => {
      const { initializeFromUrl } = useFilterUrl()

      mockRoute.query = {
        status: 'pending',
        page: '-1'
      }

      initializeFromUrl()

      expect(mockTaskStore.pagination.page).toBe(1) // Should remain default
    })
  })

  describe('URL Clearing', () => {
    it('should clear URL parameters', () => {
      const { clearUrl, initializeFromUrl } = useFilterUrl()

      // Properly initialize the composable first
      initializeFromUrl()
      mockTaskStore.filters = { status: ['pending'] }

      clearUrl()

      expect(mockPush).toHaveBeenCalledWith({
        path: '/tasks',
        query: {}
      })
    })

    it('should not clear URL if not initialized', () => {
      const { clearUrl } = useFilterUrl()

      clearUrl()

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Shareable URLs', () => {
    it('should generate shareable URL with current filters', () => {
      // Mock window.location
      const originalLocation = window.location
      delete window.location
      window.location = { origin: 'https://example.com' }

      const { getShareableUrl } = useFilterUrl()

      mockTaskStore.filters = {
        status: ['pending', 'completed'],
        priority: ['high'],
        createdFrom: '2024-01-01',
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'title',
        sortOrder: 'asc'
      }

      const url = getShareableUrl()

      expect(url).toBe(
        'https://example.com/tasks?status=pending%2Ccompleted&priority=high&createdFrom=2024-01-01&sortBy=title&sortOrder=asc'
      )

      // Restore window.location
      window.location = originalLocation
    })

    it('should generate base URL when no filters are active', () => {
      // Mock window.location
      const originalLocation = window.location
      delete window.location
      window.location = { origin: 'https://example.com' }

      const { getShareableUrl } = useFilterUrl()

      mockTaskStore.filters = {
        status: [],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const url = getShareableUrl()

      expect(url).toBe('https://example.com/tasks')

      // Restore window.location
      window.location = originalLocation
    })
  })

  describe('Round-trip Consistency', () => {
    it('should maintain filter integrity through serialize/deserialize cycle', () => {
      const { serializeFilters, deserializeFilters } = useFilterUrl()

      const originalFilters = {
        status: ['pending', 'in-progress'],
        priority: ['high', 'medium'],
        createdFrom: '2024-01-01',
        createdTo: '2024-01-31',
        completedFrom: '2024-01-15',
        completedTo: null,
        sortBy: 'priority',
        sortOrder: 'asc'
      }

      const serialized = serializeFilters(originalFilters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized).toEqual(originalFilters)
    })

    it('should handle edge cases in round-trip', () => {
      const { serializeFilters, deserializeFilters } = useFilterUrl()

      const originalFilters = {
        status: [],
        priority: ['low'],
        createdFrom: null,
        createdTo: '2024-01-31',
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      const serialized = serializeFilters(originalFilters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized).toEqual(originalFilters)
    })
  })

  describe('Error Handling', () => {
    it('should handle router navigation failures gracefully', () => {
      const { updateUrl } = useFilterUrl()

      // Mock router push to reject
      mockPush.mockRejectedValue(new Error('Navigation failed'))

      const filters = {
        status: ['pending'],
        priority: [],
        createdFrom: null,
        createdTo: null,
        completedFrom: null,
        completedTo: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }

      // Should not throw
      expect(() => updateUrl(filters)).not.toThrow()
    })

    it('should handle malformed URL parameters', () => {
      const { deserializeFilters } = useFilterUrl()

      const query = {
        status: null,
        priority: undefined,
        createdFrom: '',
        sortBy: 'invalid-field'
      }

      const result = deserializeFilters(query)

      // Should return valid filter structure with defaults
      expect(result.status).toEqual([])
      expect(result.priority).toEqual([])
      expect(result.createdFrom).toBeNull()
      expect(result.sortBy).toBe('invalid-field') // Should pass through, validation happens elsewhere
    })
  })
})
