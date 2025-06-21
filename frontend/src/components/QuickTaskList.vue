<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      Recent Tasks
      <v-spacer></v-spacer>
      <v-btn
        size="small"
        color="secondary"
        variant="text"
        :to="'/exports'"
        class="mr-2"
      >
        <v-icon start size="18">mdi-download</v-icon>
        Export
      </v-btn>
      <v-btn size="small" color="primary" variant="text" :to="'/tasks'">
        View All
      </v-btn>
    </v-card-title>

    <v-card-text>
      <div v-if="taskStore.loading" class="text-center py-4">
        <v-progress-circular indeterminate size="24"></v-progress-circular>
      </div>

      <div v-else-if="recentTasks.length === 0" class="text-center py-4">
        <v-icon size="48" color="grey-lighten-1">mdi-format-list-checks</v-icon>
        <p class="text-grey mt-2">No tasks yet</p>
      </div>

      <v-list v-else density="compact">
        <v-list-item
          v-for="task in recentTasks"
          :key="task._id"
          :title="task.title"
          :subtitle="task.description"
          class="task-item-mini"
        >
          <template #prepend>
            <v-icon :color="getStatusColor(task.status)">
              {{ getStatusIcon(task.status) }}
            </v-icon>
          </template>

          <template #append>
            <v-chip
              :color="getPriorityColor(task.priority)"
              size="x-small"
              variant="flat"
            >
              {{ task.priority }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'

const taskStore = useTaskStore()

const recentTasks = computed(() => taskStore.tasks.slice(0, 5))

function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-progress':
      return 'info'
    case 'completed':
      return 'success'
    default:
      return 'grey'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending':
      return 'mdi-clock-outline'
    case 'in-progress':
      return 'mdi-progress-clock'
    case 'completed':
      return 'mdi-check-circle'
    default:
      return 'mdi-help-circle'
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'error'
    default:
      return 'grey'
  }
}
</script>

<style scoped>
.task-item-mini {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.task-item-mini:last-child {
  border-bottom: none;
}
</style>
