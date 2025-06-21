<!--
/**
 * @fileoverview Unified activity feed combining task and export activities
 * @component UnifiedActivity
 * @description Shows recent task and export activities in chronological order with interactive elements
 */
-->

<template>
  <v-card elevation="1" class="unified-activity-panel">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon class="mr-2" color="primary">mdi-timeline</v-icon>
        Recent Activity
      </div>
      <div class="d-flex ga-1">
        <v-btn
          size="small"
          variant="text"
          append-icon="mdi-arrow-right"
          @click="navigateToTasks"
        >
          Tasks
        </v-btn>
        <v-btn
          size="small"
          variant="text"
          append-icon="mdi-arrow-right"
          @click="navigateToExports"
        >
          Exports
        </v-btn>
      </div>
    </v-card-title>

    <v-card-text v-if="analyticsStore.loading" class="text-center py-4">
      <v-progress-circular
        indeterminate
        size="32"
        color="primary"
      ></v-progress-circular>
    </v-card-text>

    <v-card-text v-else-if="unifiedActivity.length === 0" class="text-center py-6">
      <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-timeline-outline</v-icon>
      <p class="text-body-2 text-medium-emphasis">No recent activity</p>
    </v-card-text>

    <v-list v-else density="compact" class="activity-list">
      <v-list-item
        v-for="activity in unifiedActivity"
        :key="`${activity.type}-${activity.id}`"
        class="activity-item"
        :class="{ 'task-activity': activity.type === 'task', 'export-activity': activity.type === 'export' }"
      >
        <template #prepend>
          <v-avatar
            size="36"
            :color="activity.color"
            variant="tonal"
            class="activity-avatar"
          >
            <v-icon size="18" :color="activity.color">
              {{ activity.icon }}
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="text-body-2 font-weight-medium">
          <span class="activity-type-badge" :class="`${activity.type}-badge`">
            {{ activity.type.toUpperCase() }}
          </span>
          {{ activity.title }}
        </v-list-item-title>

        <v-list-item-subtitle class="text-caption">
          <span class="activity-action">{{ formatAction(activity.action) }}</span>
          <span class="activity-time">{{ formatTimeAgo(activity.timestamp) }}</span>
          <br>
          <span class="text-medium-emphasis">{{ activity.subtitle }}</span>
        </v-list-item-subtitle>

        <template #append>
          <div class="d-flex ga-1" v-if="activity.actionable">
            <!-- Download Button for completed exports -->
            <v-btn
              v-if="activity.type === 'export' && activity.status === 'completed'"
              icon
              size="small"
              variant="text"
              color="primary"
              :loading="downloadingIds.includes(activity.exportId)"
              @click="downloadExport(activity.exportId)"
            >
              <v-icon size="16">mdi-download</v-icon>
              <v-tooltip activator="parent" location="top">
                Download {{ activity.format?.toUpperCase() }}
              </v-tooltip>
            </v-btn>

            <!-- Repeat Export Button for failed exports -->
            <v-btn
              v-if="activity.type === 'export' && activity.status === 'failed'"
              icon
              size="small"
              variant="text"
              color="success"
              :loading="repeatingIds.includes(activity.exportId)"
              @click="repeatExport(activity.exportId)"
            >
              <v-icon size="16">mdi-repeat</v-icon>
              <v-tooltip activator="parent" location="top">
                Retry Export
              </v-tooltip>
            </v-btn>

            <!-- View Task Button -->
            <v-btn
              v-if="activity.type === 'task'"
              icon
              size="small"
              variant="text"
              color="info"
              @click="viewTask(activity.id)"
            >
              <v-icon size="16">mdi-eye</v-icon>
              <v-tooltip activator="parent" location="top">
                View Task
              </v-tooltip>
            </v-btn>
          </div>
          <div v-else>
            <v-chip
              :color="activity.color"
              size="x-small"
              variant="outlined"
              class="activity-status-chip"
            >
              {{ activity.status }}
            </v-chip>
          </div>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAnalyticsStore } from '../stores/analyticsStore.js'
import { useExportStore } from '../stores/exportStore.js'

const router = useRouter()
const analyticsStore = useAnalyticsStore()
const exportStore = useExportStore()

// Reactive state
const downloadingIds = ref([])
const repeatingIds = ref([])

// Computed
const unifiedActivity = computed(() => analyticsStore.analytics.unifiedActivity || [])

// Methods
const navigateToTasks = () => {
  router.push('/tasks')
}

const navigateToExports = () => {
  router.push('/export-history')
}

const viewTask = (taskId) => {
  router.push(`/tasks/${taskId}`)
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
const formatAction = (action) => {
  const actionMap = {
    created: 'Created',
    updated: 'Updated',
    started: 'Started',
    completed: 'Completed',
    failed: 'Failed',
    processing: 'Processing'
  }
  return actionMap[action] || action
}

const formatTimeAgo = (timestamp) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffInSeconds = Math.floor((now - time) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}m ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}d ago`
  }
}
</script>

<style scoped>
.unified-activity-panel {
  min-width: 320px;
}

.activity-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background-color 0.2s ease;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.activity-avatar {
  margin-right: 12px;
}

.activity-type-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.task-badge {
  background-color: rgba(33, 150, 243, 0.1);
  color: #1976d2;
}

.export-badge {
  background-color: rgba(156, 39, 176, 0.1);
  color: #7b1fa2;
}

.activity-action {
  font-weight: 500;
  margin-right: 8px;
}

.activity-time {
  color: rgba(0, 0, 0, 0.6);
}

.activity-status-chip {
  font-size: 0.65rem;
}

.task-activity {
  border-left: 3px solid #2196f3;
}

.export-activity {
  border-left: 3px solid #9c27b0;
}
</style> 