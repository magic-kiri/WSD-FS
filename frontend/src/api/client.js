/**
 * @fileoverview HTTP API client for task management backend
 * @module api/client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * HTTP client for communicating with the task management API
 * @class ApiClient
 */
class ApiClient {
  /**
   * Creates ApiClient instance with base URL configuration
   */
  constructor() {
    this.baseURL = `${API_BASE_URL}/api`
  }

  /**
   * Makes HTTP request to API endpoint with error handling
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options={}] - Fetch options
   * @returns {Promise<Object>} API response data
   * @throws {Error} Network or API errors
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        )
      }

      return data
    } catch (error) {
      console.error('API Request failed:', error)
      throw error
    }
  }

  /**
   * Makes GET request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [params={}] - URL query parameters
   * @returns {Promise<Object>} API response data
   */
  async get(endpoint, params = {}) {
    const searchParams = new URLSearchParams()

    // Handle array parameters properly
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Append each array element as a separate query parameter
        value.forEach((item) => searchParams.append(key, item))
      } else if (value !== null && value !== undefined && value !== '') {
        searchParams.append(key, value)
      }
    })

    const query = searchParams.toString()
    const url = query ? `${endpoint}?${query}` : endpoint
    return this.request(url, { method: 'GET' })
  }

  /**
   * Makes POST request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response data
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    })
  }

  /**
   * Makes PUT request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response data
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    })
  }

  /**
   * Makes DELETE request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @returns {Promise<Object>} API response data
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }

  /**
   * Retrieves tasks with optional filtering and pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit, status, priority, etc.)
   * @returns {Promise<Object>} Paginated tasks response
   */
  async getTasks(params = {}) {
    return this.get('/tasks', params)
  }

  /**
   * Retrieves a specific task by ID
   * @async
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async getTask(id) {
    return this.get(`/tasks/${id}`)
  }

  /**
   * Creates a new task
   * @async
   * @param {Object} task - Task data
   * @returns {Promise<Object>} Created task response
   */
  async createTask(task) {
    return this.post('/tasks', task)
  }

  /**
   * Updates an existing task
   * @async
   * @param {string} id - Task ID
   * @param {Object} updates - Task update data
   * @returns {Promise<Object>} Updated task response
   */
  async updateTask(id, updates) {
    return this.put(`/tasks/${id}`, updates)
  }

  /**
   * Deletes a task by ID
   * @async
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Deletion confirmation response
   */
  async deleteTask(id) {
    return this.delete(`/tasks/${id}`)
  }

  /**
   * Retrieves analytics and metrics data
   * @async
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalytics() {
    return this.get('/analytics')
  }

  /**
   * Checks API health status
   * @async
   * @returns {Promise<Object>} Health check response
   */
  async getHealth() {
    return this.get('/health')
  }

  /**
   * Initiates a new export request
   * @async
   * @param {Object} exportData - Export configuration (filters, format)
   * @returns {Promise<Object>} Export initiation response
   */
  async initiateExport(exportData) {
    return this.post('/exports', exportData)
  }

  /**
   * Gets export status and progress
   * @async
   * @param {string} exportId - Export identifier
   * @returns {Promise<Object>} Export status information
   */
  async getExportStatus(exportId) {
    return this.get(`/exports/${exportId}/status`)
  }

  /**
   * Downloads completed export
   * @async
   * @param {string} exportId - Export identifier
   * @returns {Promise<Response>} Export file download response
   */
  async downloadExport(exportId) {
    const url = `${this.baseURL}/exports/${exportId}/download`
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    // Create blob and trigger download
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl

    // Get filename from response headers or generate one
    const contentDisposition = response.headers.get('content-disposition')
    let filename = 'export'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    } else {
      // If no content-disposition header, try to determine format from content-type
      const contentType = response.headers.get('content-type')
      if (contentType) {
        if (contentType.includes('text/csv')) {
          filename = 'export.csv'
        } else if (contentType.includes('application/json')) {
          filename = 'export.json'
        } else {
          filename = 'export.txt'
        }
      }
    }

    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)

    return response
  }

  /**
   * Gets user's export history with pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit, status, format)
   * @returns {Promise<Object>} Paginated export history
   */
  async getExportHistory(params = {}) {
    return this.get('/exports/history', params)
  }

  /**
   * Repeats a failed export
   * @async
   * @param {string} exportId - Export identifier to repeat
   * @returns {Promise<Object>} Repeat export response
   */
  async repeatExport(exportId) {
    return this.post(`/exports/${exportId}/repeat`, {})
  }
}

export default new ApiClient()
