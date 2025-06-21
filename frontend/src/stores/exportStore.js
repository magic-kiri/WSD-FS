/**
 * @fileoverview Pinia store for export history management
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'

export const useExportStore = defineStore('exportStore', () => {
  // State
  const exports = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Computed
  const hasExports = computed(() => exports.value.length > 0)
  const recentExports = computed(() => exports.value.slice(0, 5))
  const completedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'completed')
  )
  const failedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'failed')
  )
  const pendingExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'pending')
  )
  const processingExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'processing')
  )

  const exportStats = computed(() => ({
    total: exports.value.length,
    completed: completedExports.value.length,
    failed: failedExports.value.length,
    pending: pendingExports.value.length,
    processing: processingExports.value.length,
    successRate:
      exports.value.length > 0
        ? Math.round(
            (completedExports.value.length / exports.value.length) * 100
          )
        : 0
  }))

  // Actions
  const fetchExportHistory = async (params = {}) => {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getExportHistory({
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...params
      })

      exports.value = response.data.exports
      pagination.value = {
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }
    } catch (err) {
      error.value = err.message
      console.error('Error fetching export history:', err)
    } finally {
      loading.value = false
    }
  }

  const initiateExport = async (exportData) => {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.initiateExport(exportData)

      // Add the new export to the beginning of the list
      exports.value.unshift(response.data.export)

      return response.data.export
    } catch (err) {
      error.value = err.message
      console.error('Error initiating export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const checkExportStatus = async (exportId) => {
    try {
      const response = await apiClient.getExportStatus(exportId)

      // Update the export in the list
      const exportIndex = exports.value.findIndex((exp) => exp.id === exportId)
      if (exportIndex !== -1) {
        exports.value[exportIndex] = {
          ...exports.value[exportIndex],
          ...response.data.export
        }
      }

      return response.data.export
    } catch (err) {
      console.error('Error checking export status:', err)
      throw err
    }
  }

  const downloadExport = async (exportId) => {
    try {
      const response = await apiClient.downloadExport(exportId)

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

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
      link.click()

      // Clean up
      window.URL.revokeObjectURL(url)

      return true
    } catch (err) {
      console.error('Error downloading export:', err)
      throw err
    }
  }

  const repeatExport = async (exportId) => {
    try {
      const response = await apiClient.repeatExport(exportId)

      // Update the existing export in the list
      const exportIndex = exports.value.findIndex(
        (exp) => exp.exportId === exportId
      )
      if (exportIndex !== -1) {
        exports.value[exportIndex] = {
          ...exports.value[exportIndex],
          status: 'pending',
          errorMessage: null,
          completedAt: null,
          fileSize: 0,
          taskCount: 0
        }
      }

      return response.data
    } catch (err) {
      console.error('Error repeating export:', err)
      throw err
    }
  }

  const setPage = (page) => {
    pagination.value.page = page
  }

  const setLimit = (limit) => {
    pagination.value.limit = limit
    pagination.value.page = 1 // Reset to first page when changing limit
  }

  const resetStore = () => {
    exports.value = []
    error.value = null
    pagination.value = {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    }
  }

  return {
    // State
    exports,
    loading,
    error,
    pagination,

    // Computed
    hasExports,
    recentExports,
    completedExports,
    failedExports,
    pendingExports,
    processingExports,
    exportStats,

    // Actions
    fetchExportHistory,
    initiateExport,
    checkExportStatus,
    downloadExport,
    repeatExport,
    setPage,
    setLimit,
    resetStore
  }
})
