<!--
/**
 * @fileoverview Export History view for managing and accessing user's export history
 * @component ExportHistory
 * @description Displays paginated export history with download and repeat functionality
 */
-->

<template>
  <div class="export-history-page">
    <!-- Page Header -->
    <div class="d-flex justify-space-between align-center mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Export History</h1>
        <p class="text-subtitle-1 text-medium-emphasis mt-1">
          View and manage your export history
        </p>
      </div>

      <v-btn
        color="primary"
        variant="elevated"
        prepend-icon="mdi-plus"
        @click="navigateToTasks"
      >
        New Export
      </v-btn>
    </div>

    <!-- Export History Table -->
    <v-card elevation="1">
      <v-card-text v-if="exportStore.loading" class="text-center py-8">
        <v-progress-circular
          indeterminate
          color="primary"
          size="48"
        ></v-progress-circular>
        <p class="mt-4 text-medium-emphasis">Loading export history...</p>
      </v-card-text>

      <v-card-text v-else-if="exportStore.error" class="text-center py-8">
        <v-icon color="error" size="48" class="mb-4">mdi-alert-circle</v-icon>
        <p class="text-error">{{ exportStore.error }}</p>
        <v-btn variant="outlined" class="mt-2" @click="fetchData">Retry</v-btn>
      </v-card-text>

      <div v-else-if="!exportStore.hasExports" class="text-center py-12">
        <v-icon size="64" color="grey-lighten-1" class="mb-4"
          >mdi-file-export-outline</v-icon
        >
        <h3 class="text-h6 mb-2">No exports yet</h3>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Start by creating your first export from the Tasks page
        </p>
        <v-btn color="primary" @click="navigateToTasks">Create Export</v-btn>
      </div>

      <v-data-table
        v-else
        :headers="tableHeaders"
        :items="exportStore.exports"
        :loading="exportStore.loading"
        item-key="exportId"
        class="export-history-table"
        :items-per-page="-1"
        hide-default-footer
      >
        <!-- Status Column -->
        <template #[`item.status`]="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            :variant="item.status === 'completed' ? 'flat' : 'outlined'"
            size="small"
            class="text-caption font-weight-medium"
          >
            <v-icon v-if="item.status === 'pending'" start size="16"
              >mdi-clock-outline</v-icon
            >
            <v-icon v-else-if="item.status === 'processing'" start size="16"
              >mdi-cog</v-icon
            >
            <v-icon v-else-if="item.status === 'completed'" start size="16"
              >mdi-check</v-icon
            >
            <v-icon v-else-if="item.status === 'failed'" start size="16"
              >mdi-alert</v-icon
            >
            {{ item.status }}
          </v-chip>
        </template>

        <!-- Format Column -->
        <template #[`item.format`]="{ item }">
          <v-chip color="default" variant="tonal" size="small">
            <v-icon start size="16">
              {{
                item.format === 'csv' ? 'mdi-file-delimited' : 'mdi-code-json'
              }}
            </v-icon>
            {{ item.format.toUpperCase() }}
          </v-chip>
        </template>

        <!-- Created Date Column -->
        <template #[`item.createdAt`]="{ item }">
          <div class="text-body-2">
            {{ formatDate(item.createdAt) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ formatTimeAgo(item.createdAt) }}
          </div>
        </template>

        <!-- File Size Column -->
        <template #[`item.fileSize`]="{ item }">
          <div class="text-body-2">
            {{ item.fileSize ? formatFileSize(item.fileSize) : 'N/A' }}
          </div>
        </template>

        <!-- Filters Applied Column -->
        <template #[`item.filters`]="{ item }">
          <div v-if="item.filters && Object.keys(item.filters).length > 0">
            <v-chip
              v-for="(value, key) in getFilterSummary(item.filters)"
              :key="key"
              size="x-small"
              variant="outlined"
              class="ma-1"
            >
              {{ key }}: {{ value }}
            </v-chip>
          </div>
          <span v-else class="text-caption text-medium-emphasis"
            >No filters</span
          >
        </template>

        <!-- Actions Column -->
        <template #[`item.actions`]="{ item }">
          <div class="d-flex ga-2">
            <!-- Download Button -->
            <v-btn
              v-if="item.status === 'completed'"
              icon="mdi-download"
              size="small"
              variant="text"
              color="primary"
              :loading="downloadingIds.includes(item.exportId)"
              @click="downloadExport(item.exportId)"
            >
              <v-icon>mdi-download</v-icon>
              <v-tooltip activator="parent" location="top">
                Download Export
              </v-tooltip>
            </v-btn>

            <!-- Repeat Export Button -->
            <v-btn
              v-if="item.status === 'failed'"
              icon="mdi-repeat"
              size="small"
              variant="text"
              color="success"
              :loading="repeatingIds.includes(item.exportId)"
              @click="repeatExport(item.exportId)"
            >
              <v-icon>mdi-repeat</v-icon>
              <v-tooltip activator="parent" location="top">
                Repeat Export
              </v-tooltip>
            </v-btn>
          </div>
        </template>
      </v-data-table>

      <!-- Pagination and Per Page Controls -->
      <v-card-actions v-if="exportStore.hasExports">
        <div class="d-flex align-center ga-4">
          <v-select
            v-model="exportStore.pagination.limit"
            label="Per Page"
            :items="[10, 25, 50, 100]"
            variant="outlined"
            density="compact"
            style="width: 120px"
            @update:model-value="exportStore.setLimit"
          ></v-select>
        </div>
        <v-spacer></v-spacer>
        <div class="d-flex align-center ga-4">
          <span class="text-caption text-medium-emphasis">
            {{ paginationText }}
          </span>
          <v-pagination
            v-model="exportStore.pagination.page"
            :length="exportStore.pagination.totalPages"
            :total-visible="7"
            size="small"
            @update:model-value="changePage"
          ></v-pagination>
        </div>
      </v-card-actions>
    </v-card>

    <!-- Export Progress Modal -->
    <ExportModal
      v-model="exportModalOpen"
      :is-repeat="true"
      :repeat-export-id="repeatExportId"
      @export-completed="onExportCompleted"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExportStore } from '../stores/exportStore.js'
import ExportModal from '../components/ExportModal.vue'

const router = useRouter()
const exportStore = useExportStore()

// Reactive state
const downloadingIds = ref([])
const repeatingIds = ref([])
const exportModalOpen = ref(false)
const repeatExportId = ref('')

// Table configuration
const tableHeaders = [
  { title: 'Status', key: 'status', width: '100px' },
  { title: 'Format', key: 'format', width: '80px' },
  { title: 'Created', key: 'createdAt', width: '150px' },
  { title: 'Size', key: 'fileSize', width: '80px' },
  { title: 'Filters', key: 'filters', width: '200px' },
  { title: 'Actions', key: 'actions', width: '120px', sortable: false }
]

// Computed properties
const paginationText = computed(() => {
  const { page, limit, total } = exportStore.pagination
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  return `${start}-${end} of ${total}`
})

// Methods
const fetchData = async () => {
  await exportStore.fetchExportHistory()
}

const changePage = (page) => {
  exportStore.setPage(page)
  fetchData()
}

const navigateToTasks = () => {
  router.push('/tasks')
}

const downloadExport = async (exportId) => {
  downloadingIds.value.push(exportId)
  try {
    await exportStore.downloadExport(exportId)
  } catch (error) {
    console.error('Download failed:', error)
    // Could show notification here
  } finally {
    downloadingIds.value = downloadingIds.value.filter((id) => id !== exportId)
  }
}

const onExportCompleted = () => {
  // Handle export completion by refreshing the data
  fetchData()
}

const repeatExport = async (exportId) => {
  repeatingIds.value.push(exportId)
  try {
    // Set up modal for progress tracking
    repeatExportId.value = exportId
    exportModalOpen.value = true

    // The modal will handle the actual repeat export API call
    // We don't need to call the store method here
  } catch (error) {
    console.error('Repeat export failed:', error)
    // Close modal on error
    exportModalOpen.value = false
    // Could show error notification here
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

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
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

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getFilterSummary = (filters) => {
  const summary = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== '' && (!Array.isArray(value) || value.length > 0)) {
      if (Array.isArray(value)) {
        summary[key] = value.join(', ')
      } else {
        summary[key] = value
      }
    }
  })
  return summary
}

// Lifecycle
onMounted(() => {
  fetchData()
})

// Watchers
watch(
  () => exportStore.pagination.limit,
  () => {
    fetchData()
  }
)
</script>

<style scoped>
.export-history-page {
  padding: 24px;
  /* max-width: 1200px; */
  margin: 0 auto;
}

.export-history-table :deep(.v-data-table__td) {
  padding: 16px 16px;
  font-size: 0.95rem;
}

.export-history-table :deep(.v-data-table__th) {
  font-weight: 600;
  font-size: 0.9rem;
}

/* Increase font sizes for table content */
.export-history-table :deep(.text-body-2) {
  font-size: 0.95rem !important;
  line-height: 1.4;
}

.export-history-table :deep(.text-caption) {
  font-size: 0.8rem !important;
  line-height: 1.3;
}

/* Status and format chips */
.export-history-table :deep(.v-chip) {
  font-size: 0.8rem;
  height: 28px;
}

.export-history-table :deep(.v-chip.v-chip--size-small) {
  font-size: 0.8rem;
  height: 28px;
}

.export-history-table :deep(.v-chip.v-chip--size-x-small) {
  font-size: 0.75rem;
  height: 24px;
}

/* Action buttons */
.export-history-table :deep(.v-btn--size-small) {
  min-width: 36px;
  height: 36px;
}
</style>
