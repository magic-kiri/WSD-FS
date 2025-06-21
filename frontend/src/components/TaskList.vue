<!--
/**
 * @fileoverview Task management component with CRUD operations, filtering, and pagination
 * @component TaskList
 * @description Comprehensive task list interface with create, edit, delete, filter, and sort capabilities
 * @emits {Object} task-created - Emitted when a new task is created
 * @emits {Object} task-updated - Emitted when a task is updated
 * @emits {String} task-deleted - Emitted when a task is deleted
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h2 class="page-title">Tasks</h2>
      <v-spacer></v-spacer>
      <div class="d-flex ga-2">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showCreateDialog = true">
          New Task
        </v-btn>
      </div>
    </div>

    <!-- Enhanced Filter Bar -->
    <filter-bar />

    <div v-if="taskStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="taskStore.error" class="text-center py-8">
      <v-alert type="error">{{ taskStore.error }}</v-alert>
    </div>

    <div v-else-if="taskStore.tasks.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-format-list-checks</v-icon>
      <p class="text-grey mt-2">
        {{
          taskStore.activeFilterCount > 0
            ? 'No tasks match your filters'
            : 'No tasks found'
        }}
      </p>
      <v-btn
        v-if="taskStore.activeFilterCount > 0"
        variant="outlined"
        @click="taskStore.clearAllFilters"
      >
        Clear Filters
      </v-btn>
    </div>

    <div v-else>
      <v-card
        v-for="task in taskStore.tasks"
        :key="task._id"
        class="task-item mb-3"
        @click="editTask(task)"
      >
        <v-card-text>
          <div class="d-flex align-start">
            <div class="flex-grow-1">
              <h3 class="task-title">{{ task.title }}</h3>
              <p v-if="task.description" class="text-body-2 mb-2">
                {{ task.description }}
              </p>
              <div class="task-meta">
                <v-chip
                  :color="getStatusColor(task.status)"
                  size="small"
                  variant="flat"
                >
                  {{ formatStatus(task.status) }}
                </v-chip>
                <v-chip
                  :color="getPriorityColor(task.priority)"
                  size="small"
                  variant="outlined"
                >
                  {{ formatPriority(task.priority) }}
                </v-chip>
                <span class="text-caption text-medium-emphasis">
                  Created {{ formatDate(task.createdAt) }}
                </span>
                <span v-if="task.completedAt" class="text-caption text-medium-emphasis">
                  Completed {{ formatDate(task.completedAt) }}
                </span>
              </div>
            </div>
            <v-menu>
              <template #activator="{ props }">
                <v-btn icon size="small" v-bind="props" @click.stop>
                  <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="editTask(task)">
                  <v-list-item-title>Edit</v-list-item-title>
                </v-list-item>
                <v-list-item @click="deleteTask(task)">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </v-card-text>
      </v-card>

      <div class="text-center mt-4">
        <v-pagination
          v-model="taskStore.pagination.page"
          :length="taskStore.pagination.pages"
          @update:model-value="taskStore.setPage"
        ></v-pagination>
      </div>
    </div>

    <task-form-dialog v-model="showCreateDialog" @save="handleSave" />

    <task-form-dialog
      v-model="showEditDialog"
      :task="selectedTask"
      @save="handleSave"
    />

    <!-- Export Modal -->
    <export-modal v-model="showExportModal" />

    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete Task</v-card-title>
        <v-card-text>
          Are you sure you want to delete "{{ selectedTask?.title }}"?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { useFilterUrl } from '../composables/useFilterUrl.js'
import TaskFormDialog from './TaskFormDialog.vue'
import FilterBar from './FilterBar.vue'
import ExportModal from './ExportModal.vue'

const taskStore = useTaskStore()
const { initializeFromUrl } = useFilterUrl()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportModal = ref(false)
const selectedTask = ref(null)

const getStatusColor = (status) => {
  const colors = {
    pending: 'orange',
    'in-progress': 'blue',
    completed: 'green'
  }
  return colors[status] || 'grey'
}

const getPriorityColor = (priority) => {
  const colors = {
    low: 'green',
    medium: 'orange',
    high: 'red'
  }
  return colors[priority] || 'grey'
}

const formatStatus = (status) => {
  const formats = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    completed: 'Completed'
  }
  return formats[status] || status
}

const formatPriority = (priority) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

const formatDate = (date) => {
  if (!date) {
    console.warn('🔍 formatDate received null/undefined date:', date)
    return 'No date'
  }
  
  try {
    const dateObj = new Date(date)
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('🔍 formatDate received invalid date:', date)
      return 'Invalid date'
    }
    
    console.log('🔍 date', date)
    const formatted = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    console.log('🔍 formatted date', formatted)
    return formatted
  } catch (error) {
    console.error('🔍 Error formatting date:', error, 'Original date:', date)
    return 'Date error'
  }
}

const editTask = (task) => {
  selectedTask.value = task
  showEditDialog.value = true
}

const deleteTask = (task) => {
  selectedTask.value = task
  showDeleteDialog.value = true
}

const handleSave = async (taskData) => {
  try {
    if (selectedTask.value?._id) {
      await taskStore.updateTask(selectedTask.value._id, taskData)
    } else {
      await taskStore.createTask(taskData)
    }
    showCreateDialog.value = false
    showEditDialog.value = false
    selectedTask.value = null
  } catch (error) {
    console.error('Error saving task:', error)
  }
}

const confirmDelete = async () => {
  try {
    await taskStore.deleteTask(selectedTask.value._id)
    showDeleteDialog.value = false
    selectedTask.value = null
  } catch (error) {
    console.error('Error deleting task:', error)
  }
}

onMounted(() => {
  // Initialize socket listeners
  taskStore.initializeSocketListeners()

  // Initialize URL filters - this will also trigger fetchTasks
  initializeFromUrl()

  // If no URL filters and no tasks loaded, fetch with default filters
  if (taskStore.tasks.length === 0 && !taskStore.loading) {
    taskStore.fetchTasks()
  }
})

onUnmounted(() => {
  taskStore.cleanup()
})
</script>

<style scoped>
.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.task-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.task-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.task-title {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: rgb(var(--v-theme-on-surface));
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.task-meta .v-chip {
  margin-right: 0;
}
</style>
