<!--
/**
 * @fileoverview Export modal component with format selection and real-time progress
 * @component ExportModal
 * @description Modal for exporting task data with CSV/JSON format selection and socket-based progress tracking
 */
-->

<template>
  <v-dialog v-model="localDialog" max-width="500">
    <v-card>
      <v-card-title class="pt-6 d-flex align-center">
        <v-icon left color="success">mdi-download</v-icon>
        {{ props.isRepeat ? 'Repeat Export' : 'Export Tasks' }}
      </v-card-title>

      <!-- Format Selection Step -->
      <div v-if="currentStep === 'format' && !props.isRepeat">
        <v-card-text class="pa-6">
          <p class="mb-4">
            Select the format for your export. This will include all tasks
            matching your current filters.
          </p>

          <div class="text-body-2 mb-4">
            <strong>{{ filteredTaskCount }}</strong> tasks will be exported
            <span v-if="taskStore.activeFilterCount > 0">
              ({{ taskStore.activeFilterCount }} filters active)
            </span>
          </div>

          <v-radio-group v-model="selectedFormat" class="mt-4">
            <v-radio value="csv" class="mb-2">
              <template #label>
                <div class="d-flex align-center">
                  <v-icon left>mdi-file-delimited</v-icon>
                  <div>
                    <div class="font-weight-medium">CSV Format</div>
                    <div class="text-caption text-grey">
                      Excel compatible, good for data analysis
                    </div>
                  </div>
                </div>
              </template>
            </v-radio>

            <v-radio value="json" class="mb-2">
              <template #label>
                <div class="d-flex align-center">
                  <v-icon left>mdi-code-json</v-icon>
                  <div>
                    <div class="font-weight-medium">JSON Format</div>
                    <div class="text-caption text-grey">
                      Full data structure, good for developers
                    </div>
                  </div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
        </v-card-text>

        <v-card-actions class="pa-6">
          <v-spacer></v-spacer>
          <v-btn @click="closeModal">Cancel</v-btn>
          <v-btn
            color="success"
            :disabled="!selectedFormat"
            @click="initiateExport"
          >
            Start Export
          </v-btn>
        </v-card-actions>
      </div>

      <!-- Progress Step -->
      <div v-if="currentStep === 'progress'">
        <v-card-text class="text-center pa-6">
          <v-progress-circular
            :model-value="progress"
            size="80"
            width="8"
            color="success"
            class="mb-4"
          >
            {{ Math.round(progress) }}%
          </v-progress-circular>

          <h3 class="mb-2">{{ progressMessage }}</h3>

          <div v-if="exportData" class="mt-4">
            <v-chip color="success" variant="outlined" class="mr-2">
              <v-icon left>mdi-check</v-icon>
              {{ exportData.taskCount }} tasks
            </v-chip>
            <v-chip color="info" variant="outlined">
              <v-icon left>mdi-file</v-icon>
              {{ formatFileSize(exportData.fileSize) }}
            </v-chip>
          </div>
        </v-card-text>

        <v-card-actions
          v-if="currentStep === 'progress' && progress < 100"
          class="pa-6"
        >
          <v-spacer></v-spacer>
          <v-btn variant="outlined" @click="cancelExport"> Cancel </v-btn>
        </v-card-actions>
      </div>

      <!-- Success Step -->
      <div v-if="currentStep === 'success'">
        <v-card-text class="text-center pa-6">
          <v-icon size="80" color="success" class="mb-4">
            mdi-check-circle
          </v-icon>

          <h3 class="mb-2">Export Complete!</h3>
          <p class="text-body-2 mb-4">Your export is ready for download</p>

          <div class="mb-4">
            <v-chip color="success" variant="outlined" class="mr-2">
              <v-icon left>mdi-check</v-icon>
              {{ exportData?.taskCount }} tasks
            </v-chip>
            <v-chip color="info" variant="outlined">
              <v-icon left>mdi-file</v-icon>
              {{ formatFileSize(exportData?.fileSize) }}
            </v-chip>
          </div>
        </v-card-text>

        <v-card-actions class="pa-6">
          <v-spacer></v-spacer>
          <v-btn @click="closeModal">Close</v-btn>
          <v-btn color="success" @click="downloadFile">
            <v-icon left>mdi-download</v-icon>
            Download
          </v-btn>
        </v-card-actions>
      </div>

      <!-- Error Step -->
      <div v-if="currentStep === 'error'">
        <v-card-text class="text-center pa-6">
          <v-icon size="80" color="error" class="mb-4">
            mdi-alert-circle
          </v-icon>

          <h3 class="mb-2">Export Failed</h3>
          <p class="text-body-2 text-error">
            {{ errorMessage }}
          </p>
        </v-card-text>

        <v-card-actions class="pa-6">
          <v-spacer></v-spacer>
          <v-btn @click="closeModal">Close</v-btn>
          <v-btn color="primary" @click="handleTryAgain"> Try Again </v-btn>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  isRepeat: {
    type: Boolean,
    default: false
  },
  repeatExportId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'export-completed'])

const taskStore = useTaskStore()

// Local state
const localDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const currentStep = ref('format') // 'format', 'progress', 'success', 'error'
const selectedFormat = ref('')
const exportId = ref('')
const progress = ref(0)
const progressMessage = ref('')
const exportData = ref(null)
const errorMessage = ref('')

// Computed
const filteredTaskCount = computed(() => {
  return taskStore.pagination.total || taskStore.tasks.length
})

// Methods
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const resetModal = () => {
  currentStep.value = props.isRepeat ? 'progress' : 'format'
  selectedFormat.value = ''
  exportId.value = ''
  progress.value = 0
  progressMessage.value = ''
  exportData.value = null
  errorMessage.value = ''
}

const closeModal = () => {
  localDialog.value = false
  // Clean up socket listeners
  if (exportId.value) {
    socket.emit('leave-exports', exportId.value)
    cleanupSocketListeners()
  }
}

const setupSocketListeners = () => {
  socket.on('export-progress', handleExportProgress)
  socket.on('export-completed', handleExportCompleted)
  socket.on('export-error', handleExportError)
}

const cleanupSocketListeners = () => {
  socket.off('export-progress', handleExportProgress)
  socket.off('export-completed', handleExportCompleted)
  socket.off('export-error', handleExportError)
}

const handleExportProgress = (data) => {
  console.log('Received export-progress:', data)
  if (data.exportId === exportId.value) {
    progress.value = data.progress
    progressMessage.value = data.message || 'Processing export...'
  }
}

const handleExportCompleted = (data) => {
  console.log('Received export-completed:', data)
  if (data.exportId === exportId.value) {
    progress.value = 100
    progressMessage.value = 'Export completed successfully'
    exportData.value = {
      taskCount: data.result.taskCount,
      fileSize: data.result.fileSize,
      format: data.result.format
    }
    currentStep.value = 'success'

    // Emit completion event for parent to refresh data
    emit('export-completed', data)
  }
}

const handleExportError = (data) => {
  console.log('Received export-error:', data)
  if (data.exportId === exportId.value) {
    errorMessage.value = data.error || 'Export failed'
    currentStep.value = 'error'
  }
}

const cancelExport = () => {
  if (exportId.value) {
    socket.emit('leave-exports', exportId.value)
    cleanupSocketListeners()
  }
  closeModal()
}

const downloadFile = async () => {
  try {
    console.log('downloadFile called with exportId:', exportId.value)

    if (!exportId.value) {
      throw new Error('Export ID is missing. Please try restarting the export.')
    }

    await apiClient.downloadExport(exportId.value)
    closeModal()
  } catch (error) {
    console.error('Error downloading file:', error)
    errorMessage.value = error.message || 'Failed to download file'
    currentStep.value = 'error'
  }
}

const handleTryAgain = () => {
  resetModal()
  if (props.isRepeat && props.repeatExportId) {
    // For repeat exports, try the repeat API again
    initiateRepeatExport()
  }
  // For regular exports, just reset to format selection (handled by resetModal)
}

const initiateExport = async () => {
  try {
    currentStep.value = 'progress'
    progress.value = 0
    progressMessage.value = 'Initializing export...'

    // Prepare export data
    const exportRequest = {
      filters: taskStore.getFilterState(),
      format: selectedFormat.value
    }

    // Initiate export via API
    const response = await apiClient.initiateExport(exportRequest)
    exportId.value = response.data.exportId

    // Set up socket listeners first
    setupSocketListeners()

    // Connect socket and wait for connection if not connected
    if (!socket.connected) {
      await new Promise((resolve, reject) => {
        socket.connect()

        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'))
        }, 5000) // 5 second timeout

        const onConnect = () => {
          clearTimeout(timeout)
          socket.off('connect', onConnect)
          socket.off('connect_error', onError)
          resolve()
        }

        const onError = (error) => {
          clearTimeout(timeout)
          socket.off('connect', onConnect)
          socket.off('connect_error', onError)
          reject(error)
        }

        if (socket.connected) {
          clearTimeout(timeout)
          resolve()
        } else {
          socket.on('connect', onConnect)
          socket.on('connect_error', onError)
        }
      })
    }

    // Now join the export room
    socket.emit('join-exports', exportId.value)
    console.log(`Joining export room: ${exportId.value}`)

    // If cached, complete immediately
    if (response.data.cached) {
      progress.value = 100
      progressMessage.value = 'Export retrieved from cache'
      exportData.value = {
        taskCount: response.data.taskCount,
        fileSize: response.data.fileSize
      }
      currentStep.value = 'success'
    } else {
      progressMessage.value = 'Export initiated, processing...'
    }
  } catch (error) {
    console.error('Error initiating export:', error)
    errorMessage.value = error.message || 'Failed to initiate export'
    currentStep.value = 'error'
  }
}

const initiateRepeatExport = async () => {
  try {
    currentStep.value = 'progress'
    progress.value = 0
    progressMessage.value = 'Repeating export...'
    exportId.value = props.repeatExportId

    // Set up socket listeners first
    setupSocketListeners()

    // Connect socket and wait for connection if not connected
    if (!socket.connected) {
      await new Promise((resolve, reject) => {
        socket.connect()

        const timeout = setTimeout(() => {
          reject(new Error('Socket connection timeout'))
        }, 5000) // 5 second timeout

        const onConnect = () => {
          clearTimeout(timeout)
          socket.off('connect', onConnect)
          socket.off('connect_error', onError)
          resolve()
        }

        const onError = (error) => {
          clearTimeout(timeout)
          socket.off('connect', onConnect)
          socket.off('connect_error', onError)
          reject(error)
        }

        if (socket.connected) {
          clearTimeout(timeout)
          resolve()
        } else {
          socket.on('connect', onConnect)
          socket.on('connect_error', onError)
        }
      })
    }

    // Join the export room
    socket.emit('join-exports', exportId.value)
    console.log(`Joining export room for repeat: ${exportId.value}`)

    // Call the repeat API
    await apiClient.repeatExport(props.repeatExportId)

    progressMessage.value = 'Export repeat initiated, processing...'
  } catch (error) {
    console.error('Error repeating export:', error)
    errorMessage.value = error.message || 'Failed to repeat export'
    currentStep.value = 'error'
  }
}

// Watch for dialog changes
watch(localDialog, (newValue, oldValue) => {
  if (newValue && !oldValue) {
    // Only reset when opening from closed state
    resetModal()

    // If it's a repeat export, start immediately
    if (props.isRepeat && props.repeatExportId) {
      initiateRepeatExport()
    }
  } else if (!newValue && oldValue) {
    // Only cleanup when closing from open state
    if (exportId.value) {
      socket.emit('leave-exports', exportId.value)
      cleanupSocketListeners()
    }
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (exportId.value) {
    socket.emit('leave-exports', exportId.value)
    cleanupSocketListeners()
  }
})
</script>

<style scoped>
.v-radio :deep(.v-label) {
  margin-left: 8px;
}
</style>
