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

    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart">
          <v-card-title>Tasks by Status</v-card-title>
          <v-card-text>
            <task-status-chart
              :data="analyticsStore.statusData"
              :show-legend="true"
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart">
          <v-card-title>Tasks by Priority</v-card-title>
          <v-card-text>
            <task-priority-chart :data="analyticsStore.priorityData" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" md="8">
        <quick-task-list />
      </v-col>
      <v-col cols="12" md="4">
        <v-row>
          <v-col cols="12">
            <recent-activity />
          </v-col>
          <v-col cols="12">
            <export-history-panel />
          </v-col>
        </v-row>
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
import RecentActivity from '../components/RecentActivity.vue'
import ExportHistoryPanel from '../components/ExportHistoryPanel.vue'

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
</style>
