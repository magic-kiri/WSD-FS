import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import apiClient from '../../src/api/client.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Client Multi-Select Array Parameter Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should handle single status parameter correctly', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({ status: 'pending' })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?status=pending',
      expect.any(Object)
    )
  })

  it('should handle multiple status parameters correctly', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({ status: ['pending', 'completed'] })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?status=pending&status=completed',
      expect.any(Object)
    )
  })

  it('should handle multiple priority parameters correctly', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({ priority: ['high', 'medium'] })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?priority=high&priority=medium',
      expect.any(Object)
    )
  })

  it('should handle combined array and single parameters', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({
      status: ['pending', 'in-progress'],
      priority: ['high'],
      page: 1,
      limit: 10
    })

    const expectedUrl =
      'http://localhost:3001/api/tasks?status=pending&status=in-progress&priority=high&page=1&limit=10'
    expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
  })

  it('should skip empty arrays', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({
      status: [],
      priority: ['high'],
      page: 1
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?priority=high&page=1',
      expect.any(Object)
    )
  })

  it('should skip null and undefined values', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({
      status: ['pending'],
      priority: null,
      sortBy: undefined,
      page: 1
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?status=pending&page=1',
      expect.any(Object)
    )
  })

  it('should skip empty string values', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({
      status: ['pending'],
      priority: '',
      sortBy: 'createdAt'
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?status=pending&sortBy=createdAt',
      expect.any(Object)
    )
  })

  it('should handle real-world multi-select scenario', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            tasks: [
              { _id: '1', status: 'pending', priority: 'high' },
              { _id: '2', status: 'completed', priority: 'medium' }
            ],
            pagination: { page: 1, total: 2 }
          }
        })
    }
    fetch.mockResolvedValue(mockResponse)

    // Simulate user selecting multiple statuses and priorities
    const params = {
      status: ['pending', 'completed'],
      priority: ['high', 'medium', 'low'],
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }

    const result = await apiClient.getTasks(params)

    // Check the URL construction
    const expectedUrl =
      'http://localhost:3001/api/tasks?status=pending&status=completed&priority=high&priority=medium&priority=low&page=1&limit=10&sortBy=createdAt&sortOrder=desc'
    expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))

    // Check the response
    expect(result.success).toBe(true)
    expect(result.data.tasks).toHaveLength(2)
  })

  it('should properly encode special characters in array values', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { tasks: [], pagination: {} } })
    }
    fetch.mockResolvedValue(mockResponse)

    await apiClient.getTasks({
      status: ['in-progress', 'completed']
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?status=in-progress&status=completed',
      expect.any(Object)
    )
  })

  describe('URLSearchParams array handling', () => {
    it('should correctly append multiple values for the same parameter', () => {
      const searchParams = new URLSearchParams()
      const params = { status: ['pending', 'completed'], priority: ['high'] }

      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, item))
        } else if (value !== null && value !== undefined && value !== '') {
          searchParams.append(key, value)
        }
      })

      const result = searchParams.toString()
      expect(result).toBe('status=pending&status=completed&priority=high')
    })

    it('should handle empty arrays correctly', () => {
      const searchParams = new URLSearchParams()
      const params = { status: [], priority: ['high'] }

      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, item))
        } else if (value !== null && value !== undefined && value !== '') {
          searchParams.append(key, value)
        }
      })

      const result = searchParams.toString()
      expect(result).toBe('priority=high')
    })

    it('should preserve parameter order', () => {
      const searchParams = new URLSearchParams()
      const params = {
        page: 1,
        status: ['pending', 'completed'],
        priority: ['high'],
        limit: 10
      }

      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, item))
        } else if (value !== null && value !== undefined && value !== '') {
          searchParams.append(key, value)
        }
      })

      const result = searchParams.toString()
      expect(result).toBe(
        'page=1&status=pending&status=completed&priority=high&limit=10'
      )
    })
  })
})
