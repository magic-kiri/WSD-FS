<!--
/**
 * @fileoverview Export actions component for filtered task data
 * @component ExportActions
 * @description Provides CSV, JSON export functionality for filtered tasks
 */
-->

<template>
  <div class="export-actions">
    <v-menu offset-y>
      <template #activator="{ props }">
        <v-btn
          color="success"
          variant="outlined"
          v-bind="props"
          :disabled="taskStore.tasks.length === 0"
        >
          <v-icon left>mdi-download</v-icon>
          Export ({{ taskStore.tasks.length }})
        </v-btn>
      </template>
      <v-list>
        <v-list-item @click="exportAsCSV">
          <v-list-item-prepend>
            <v-icon>mdi-file-delimited</v-icon>
          </v-list-item-prepend>
          <v-list-item-title>Export as CSV</v-list-item-title>
          <v-list-item-subtitle>Excel compatible format</v-list-item-subtitle>
        </v-list-item>

        <v-list-item @click="exportAsJSON">
          <v-list-item-prepend>
            <v-icon>mdi-code-json</v-icon>
          </v-list-item-prepend>
          <v-list-item-title>Export as JSON</v-list-item-title>
          <v-list-item-subtitle>Full data structure</v-list-item-subtitle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item @click="shareFilters">
          <v-list-item-prepend>
            <v-icon>mdi-share-variant</v-icon>
          </v-list-item-prepend>
          <v-list-item-title>Share Filters</v-list-item-title>
          <v-list-item-subtitle>Copy shareable link</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- Share Dialog -->
    <v-dialog v-model="shareDialog" max-width="500">
      <v-card>
        <v-card-title>Share Filtered View</v-card-title>
        <v-card-text>
          <p class="mb-3">Copy this URL to share your current filtered view:</p>
          <v-text-field
            v-model="shareUrl"
            readonly
            variant="outlined"
            density="compact"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="copyToClipboard"
          ></v-text-field>
          <div v-if="copied" class="text-success text-caption mt-2">
            <v-icon size="small">mdi-check</v-icon>
            Copied to clipboard!
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="shareDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Export Progress -->
    <v-dialog v-model="exportDialog" max-width="400" persistent>
      <v-card>
        <v-card-text class="text-center py-6">
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
          ></v-progress-circular>
          <p class="mt-4 mb-0">Preparing export...</p>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { useFilterUrl } from '../composables/useFilterUrl.js'
import { useExportStore } from '../stores/exportStore.js'

const taskStore = useTaskStore()
const { getShareableUrl } = useFilterUrl()
const exportStore = useExportStore()

const shareDialog = ref(false)
const exportDialog = ref(false)
const copied = ref(false)

const shareUrl = computed(() => getShareableUrl())

/**
 * Formats date for export
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDateForExport = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Prepares task data for export
 * @returns {Array} Array of task objects formatted for export
 */
const prepareExportData = () => {
  return taskStore.tasks.map((task) => ({
    id: task._id,
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    estimatedTime: task.estimatedTime || '',
    createdAt: formatDateForExport(task.createdAt),
    updatedAt: formatDateForExport(task.updatedAt),
    completedAt: task.completedAt ? formatDateForExport(task.completedAt) : ''
  }))
}

/**
 * Converts array of objects to CSV format
 * @param {Array} data - Array of objects to convert
 * @returns {string} CSV formatted string
 */
const arrayToCSV = (data) => {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvHeaders = headers.join(',')

  const csvRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header]
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"') || value.includes('\n'))
        ) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      .join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}

/**
 * Downloads file with given content
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Generates filename with current date and filters
 * @param {string} extension - File extension
 * @returns {string} Generated filename
 */
const generateFilename = (extension) => {
  const date = new Date().toISOString().split('T')[0]
  const filterCount = taskStore.activeFilterCount
  const suffix = filterCount > 0 ? `-filtered-${filterCount}` : ''
  return `tasks-${date}${suffix}.${extension}`
}

/**
 * Exports tasks as CSV using the new export system
 */
const exportAsCSV = async () => {
  exportDialog.value = true

  try {
    const exportData = {
      format: 'csv',
      filters: taskStore.getFilterState(),
      options: {
        totalTasks: taskStore.pagination.total,
        exportedTasks: taskStore.tasks.length
      }
    }

    // Use the export store for better tracking
    await exportStore.initiateExport(exportData)
  } catch (error) {
    console.error('Error exporting CSV:', error)

    // Fallback to direct download on error
    try {
      const data = prepareExportData()
      const csv = arrayToCSV(data)
      const filename = generateFilename('csv')
      downloadFile(csv, filename, 'text/csv')
    } catch (fallbackError) {
      console.error('Fallback export also failed:', fallbackError)
    }
  } finally {
    exportDialog.value = false
  }
}

/**
 * Exports tasks as JSON using the new export system
 */
const exportAsJSON = async () => {
  exportDialog.value = true

  try {
    const exportData = {
      format: 'json',
      filters: taskStore.getFilterState(),
      options: {
        totalTasks: taskStore.pagination.total,
        exportedTasks: taskStore.tasks.length
      }
    }

    // Use the export store for better tracking
    await exportStore.initiateExport(exportData)
  } catch (error) {
    console.error('Error exporting JSON:', error)

    // Fallback to direct download on error
    try {
      const data = {
        exportDate: new Date().toISOString(),
        filters: taskStore.getFilterState(),
        totalTasks: taskStore.pagination.total,
        exportedTasks: taskStore.tasks.length,
        tasks: prepareExportData()
      }
      const json = JSON.stringify(data, null, 2)
      const filename = generateFilename('json')
      downloadFile(json, filename, 'application/json')
    } catch (fallbackError) {
      console.error('Fallback export also failed:', fallbackError)
    }
  } finally {
    exportDialog.value = false
  }
}

/**
 * Shows share dialog with current filter URL
 */
const shareFilters = () => {
  shareDialog.value = true
  copied.value = false
}

/**
 * Copies share URL to clipboard
 */
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 3000)
  } catch (error) {
    console.error('Error copying to clipboard:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = shareUrl.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 3000)
  }
}
</script>

<style scoped>
.export-actions {
  display: inline-block;
}
</style>
