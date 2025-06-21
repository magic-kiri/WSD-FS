<!--
/**
 * @fileoverview Main dashboard view with metrics overview and analytics charts
 * @component Dashboard
 * @description Displays key performance indicators, task status/priority charts,
 * quick task list, and recent activity in a responsive grid layout
 */
-->

<template>
  <div>
    <h1 class="page-title">Dashboard</h1>

    <!-- Main Metrics Row -->
    <v-row>
      <v-col cols="12" md="3">
        <metric-card
          title="Total Tasks"
          :value="analyticsStore.analytics.totalTasks"
          icon="mdi-format-list-checks"
          color="primary"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Completion Rate"
          :value="`${analyticsStore.analytics.completionRate}%`"
          icon="mdi-check-circle"
          color="success"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Created Today"
          :value="analyticsStore.analytics.tasksCreatedToday"
          icon="mdi-plus-circle"
          color="info"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Completed Today"
          :value="analyticsStore.analytics.tasksCompletedToday"
          icon="mdi-check-all"
          color="success"
        />
      </v-col>
    </v-row>

    <!-- Export Metrics Row - Compact Design -->
    <v-row
      v-if="analyticsStore.analytics.exportMetrics.totalExports > 0"
      class="mt-2"
    >
      <v-col cols="12" md="3">
        <metric-card
          title="Total Exports"
          :value="analyticsStore.analytics.exportMetrics.totalExports"
          icon="mdi-download-multiple"
          color="secondary"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Export Success Rate"
          :value="`${analyticsStore.analytics.exportMetrics.successRate}%`"
          icon="mdi-check-circle-outline"
          color="success"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Exports Today"
          :value="analyticsStore.analytics.exportMetrics.todayExports"
          icon="mdi-download"
          color="info"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Failed Exports"
          :value="analyticsStore.analytics.exportMetrics.failedExports"
          icon="mdi-alert-circle"
          color="error"
        />
      </v-col>
    </v-row>

    <!-- Analytics Charts Row -->
    <v-row class="mt-4">
      <v-col cols="12" md="4">
        <v-card class="chart-container equal-height-chart">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-chart-donut</v-icon>
            Tasks by Status
          </v-card-title>
          <v-card-text>
            <task-status-chart
              :data="analyticsStore.statusData"
              :show-legend="true"
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="chart-container equal-height-chart">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="warning">mdi-flag-variant</v-icon>
            Tasks by Priority
          </v-card-title>
          <v-card-text>
            <task-priority-chart :data="analyticsStore.priorityData" />
          </v-card-text>
        </v-card>
      </v-col>
      <!-- Export Status Chart - Only if exports exist -->
      <v-col
        v-if="analyticsStore.analytics.exportMetrics.totalExports > 0"
        cols="12"
        md="4"
      >
        <v-card class="chart-container equal-height-chart">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="secondary">mdi-chart-pie</v-icon>
            Export Status
          </v-card-title>
          <v-card-text>
            <task-status-chart
              :data="analyticsStore.exportStatusData"
              :show-legend="true"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Main Content Row -->
    <v-row class="mt-4">
      <v-col cols="12" md="8">
        <quick-task-list />
      </v-col>
      <v-col cols="12" md="4">
        <unified-activity />
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAnalyticsStore } from '../stores/analyticsStore.js'
import { useTaskStore } from '../stores/taskStore.js'
import MetricCard from '../components/MetricCard.vue'
import TaskStatusChart from '../components/TaskStatusChart.vue'
import TaskPriorityChart from '../components/TaskPriorityChart.vue'
import QuickTaskList from '../components/QuickTaskList.vue'
import UnifiedActivity from '../components/UnifiedActivity.vue'

const analyticsStore = useAnalyticsStore()
const taskStore = useTaskStore()

onMounted(() => {
  taskStore.fetchTasks({ limit: 5 })
})
</script>

<style scoped>
.equal-height-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.equal-height-chart .v-card-text {
  flex: 1;
  display: flex;
  align-items: center;
}

.chart-container {
  transition: all 0.3s ease;
}

.chart-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.page-title {
  font-weight: 300;
  margin-bottom: 1.5rem;
  color: rgba(0, 0, 0, 0.87);
}
</style>
