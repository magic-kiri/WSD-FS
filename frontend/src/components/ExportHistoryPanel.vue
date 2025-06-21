<!--
/**
 * @fileoverview Compact export history panel for displaying recent exports
 * @component ExportHistoryPanel
 * @description Shows recent export history with quick access to downloads and status
 */
-->

<template>
  <v-card elevation="1" class="export-history-panel">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-history</v-icon>
        Recent Exports
      </div>
      <v-btn
        size="small"
        variant="text"
        append-icon="mdi-arrow-right"
        @click="navigateToHistory"
      >
        View All
      </v-btn>
    </v-card-title>

    <v-card-text v-if="exportStore.loading" class="text-center py-4">
      <v-progress-circular
        indeterminate
        size="32"
        color="primary"
      ></v-progress-circular>
    </v-card-text>

    <v-card-text v-else-if="!exportStore.hasExports" class="text-center py-6">
      <v-icon size="48" color="grey-lighten-1" class="mb-2"
        >mdi-file-export-outline</v-icon
      >
      <p class="text-body-2 text-medium-emphasis">No exports yet</p>
    </v-card-text>

    <v-list v-else density="compact">
      <v-list-item
        v-for="exportItem in exportStore.recentExports"
        :key="exportItem.exportId"
        class="export-item"
      >
        <template #prepend>
          <v-avatar
            size="36"
            :color="getStatusColor(exportItem.status)"
            variant="tonal"
          >
            <v-icon size="18">
              {{
                exportItem.format === 'csv'
                  ? 'mdi-file-delimited'
                  : 'mdi-code-json'
              }}
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="text-body-2">
          {{ exportItem.format?.toUpperCase() }} Export
          <v-chip
            :color="getStatusColor(exportItem.status)"
            size="x-small"
            variant="outlined"
            class="ml-2"
          >
            {{ exportItem.status }}
          </v-chip>
        </v-list-item-title>

        <v-list-item-subtitle class="text-caption">
          {{ formatTimeAgo(exportItem.createdAt) }}
          <span v-if="exportItem.recordCount" class="ml-2">
            • {{ exportItem.recordCount.toLocaleString() }} records
          </span>
        </v-list-item-subtitle>

        <template #append>
          <div class="d-flex ga-1">
            <!-- Download Button -->
            <v-btn
              v-if="exportItem.status === 'completed'"
              icon
              size="small"
              variant="text"
              color="primary"
              :loading="downloadingIds.includes(exportItem.exportId)"
              @click="downloadExport(exportItem.exportId)"
            >
              <v-icon size="16">mdi-download</v-icon>
              <v-tooltip activator="parent" location="top">
                Download
              </v-tooltip>
            </v-btn>

            <!-- Refresh Status Button -->
            <v-btn
              v-else-if="
                exportItem.status === 'pending' ||
                exportItem.status === 'processing'
              "
              icon
              size="small"
              variant="text"
              color="info"
              :loading="refreshingIds.includes(exportItem.exportId)"
              @click="refreshStatus(exportItem.exportId)"
            >
              <v-icon size="16">mdi-refresh</v-icon>
              <v-tooltip activator="parent" location="top"> Refresh </v-tooltip>
            </v-btn>

            <!-- Repeat Export Button -->
            <v-btn
              icon
              size="small"
              variant="text"
              color="success"
              :loading="repeatingIds.includes(exportItem.exportId)"
              @click="repeatExport(exportItem.exportId)"
            >
              <v-icon size="16">mdi-repeat</v-icon>
              <v-tooltip activator="parent" location="top"> Repeat </v-tooltip>
            </v-btn>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <v-card-actions v-if="exportStore.hasExports">
      <v-spacer></v-spacer>
      <v-btn
        variant="outlined"
        size="small"
        append-icon="mdi-history"
        @click="navigateToHistory"
      >
        View All History
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useExportStore } from '../stores/exportStore.js'

const router = useRouter()
const exportStore = useExportStore()

// Reactive state
const downloadingIds = ref([])
const refreshingIds = ref([])
const repeatingIds = ref([])

// Methods
const navigateToHistory = () => {
  router.push('/export-history')
}

const downloadExport = async (exportId) => {
  downloadingIds.value.push(exportId)
  try {
    await exportStore.downloadExport(exportId)
  } catch (error) {
    console.error('Download failed:', error)
  } finally {
    downloadingIds.value = downloadingIds.value.filter((id) => id !== exportId)
  }
}

const refreshStatus = async (exportId) => {
  refreshingIds.value.push(exportId)
  try {
    await exportStore.checkExportStatus(exportId)
  } catch (error) {
    console.error('Status refresh failed:', error)
  } finally {
    refreshingIds.value = refreshingIds.value.filter((id) => id !== exportId)
  }
}

const repeatExport = async (exportId) => {
  repeatingIds.value.push(exportId)
  try {
    await exportStore.repeatExport(exportId)
  } catch (error) {
    console.error('Repeat export failed:', error)
  } finally {
    repeatingIds.value = repeatingIds.value.filter((id) => id !== exportId)
  }
}

// Utility functions
const getStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'error'
  }
  return colors[status] || 'default'
}

const formatTimeAgo = (dateString) => {
  const now = new Date()
  const date = new Date(dateString)
  const diffInHours = (now - date) / (1000 * 60 * 60)

  if (diffInHours < 1) return 'Just now'
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return `${diffInDays}d ago`

  const diffInMonths = Math.floor(diffInDays / 30)
  return `${diffInMonths}mo ago`
}

// Lifecycle
onMounted(async () => {
  // Load recent exports with minimal params
  await exportStore.fetchExportHistory({ limit: 5 })
})
</script>

<style scoped>
.export-history-panel {
  min-width: 300px;
}

.export-item :deep(.v-list-item__content) {
  padding: 8px 0;
}
</style>
