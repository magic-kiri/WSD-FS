<!--
/**
 * @fileoverview Enhanced filtering interface with basic/advanced filters, presets, and active filter management
 * @component FilterBar
 * @description Main filtering component with progressive disclosure design
 */
-->

<template>
  <div class="filter-bar">
    <!-- Basic Filters Section -->
    <v-card class="mb-4">
      <v-card-text class="pb-2">
        <div class="d-flex align-center mb-3">
          <h3 class="text-h6">Filters</h3>
          <v-spacer></v-spacer>
          <v-chip
            v-if="taskStore.activeFilterCount > 0"
            color="primary"
            size="small"
            variant="outlined"
          >
            {{ taskStore.activeFilterCount }} active
          </v-chip>
          <v-btn
            v-if="taskStore.activeFilterCount > 0"
            variant="text"
            size="small"
            @click="taskStore.clearAllFilters"
          >
            Clear All
          </v-btn>
        </div>

        <!-- Basic Filter Controls -->
        <v-row align="center" class="pb-1">
          <!-- Search Text Field -->
          <v-col cols="12" md="4">
            <v-text-field
              v-model="localFilters.text"
              label="Search tasks..."
              placeholder="Search in title and description"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
              @update:model-value="updateFilters({ text: $event })"
            >
              <template #append-inner>
                <v-icon
                  v-if="localFilters.text"
                  @click="updateFilters({ text: '' })"
                >
                  mdi-close
                </v-icon>
              </template>
            </v-text-field>
          </v-col>

          <v-col cols="12" md="4">
            <v-select
              v-model="localFilters.status"
              :items="statusOptions"
              label="Status"
              multiple
              chips
              clearable
              variant="outlined"
              density="comfortable"
              hide-details
              @update:model-value="updateFilters({ status: $event })"
            >
              <template #chip="{ props, item }">
                <v-chip
                  v-bind="props"
                  :color="getStatusChipColor(item.raw.value)"
                  size="small"
                  variant="flat"
                >
                  {{ item.raw.title }}
                </v-chip>
              </template>
            </v-select>
          </v-col>

          <v-col cols="12" md="4">
            <v-select
              v-model="localFilters.priority"
              :items="priorityOptions"
              label="Priority"
              multiple
              chips
              clearable
              variant="outlined"
              density="comfortable"
              hide-details
              @update:model-value="updateFilters({ priority: $event })"
            >
              <template #chip="{ props, item }">
                <v-chip
                  v-bind="props"
                  :color="getPriorityChipColor(item.raw.value)"
                  size="small"
                  variant="outlined"
                >
                  {{ item.raw.title }}
                </v-chip>
              </template>
            </v-select>
          </v-col>
        </v-row>

        <!-- Action Buttons Row -->
        <v-row align="center" class="pt-1 pb-2">
          <v-col cols="12" class="d-flex align-center">
            <div class="d-flex ga-2">
              <v-btn
                color="primary"
                variant="outlined"
                size="default"
                @click="showAdvanced = !showAdvanced"
              >
                <v-icon left>
                  {{ showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                </v-icon>
                Advanced
              </v-btn>

              <v-menu offset-y>
                <template #activator="{ props }">
                  <v-btn variant="outlined" size="default" v-bind="props">
                    <v-icon left>mdi-bookmark-multiple</v-icon>
                    Presets
                  </v-btn>
                </template>
                <v-list>
                  <v-list-item
                    v-for="preset in taskStore.filterPresets"
                    :key="preset.name"
                    @click="taskStore.applyFilterPreset(preset)"
                  >
                    <v-list-item-title>{{ preset.name }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>

              <v-btn
                color="success"
                variant="outlined"
                size="default"
                :disabled="taskStore.pagination.total === 0"
                @click="showExportModal = true"
              >
                <v-icon left>mdi-download</v-icon>
                Export
              </v-btn>
            </div>
          </v-col>
        </v-row>

        <!-- Advanced Filters Section -->
        <v-expand-transition>
          <div v-show="showAdvanced">
            <v-divider></v-divider>
            <v-card-text>
              <v-row>
                <!-- Date Range Filters -->
                <v-col cols="12" md="6">
                  <h4 class="text-subtitle-1 mb-3">Created Date Range</h4>
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localFilters.createdFrom"
                        label="From"
                        type="date"
                        variant="outlined"
                        density="compact"
                        @update:model-value="
                          updateFilters({ createdFrom: $event })
                        "
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localFilters.createdTo"
                        label="To"
                        type="date"
                        variant="outlined"
                        density="compact"
                        @update:model-value="
                          updateFilters({ createdTo: $event })
                        "
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-col>

                <v-col cols="12" md="6">
                  <h4 class="text-subtitle-1 mb-3">Completed Date Range</h4>
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localFilters.completedFrom"
                        label="From"
                        type="date"
                        variant="outlined"
                        density="compact"
                        @update:model-value="
                          updateFilters({ completedFrom: $event })
                        "
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="localFilters.completedTo"
                        label="To"
                        type="date"
                        variant="outlined"
                        density="compact"
                        @update:model-value="
                          updateFilters({ completedTo: $event })
                        "
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-col>

                <!-- Sorting Options -->
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localFilters.sortBy"
                    :items="sortOptions"
                    label="Sort by"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateFilters({ sortBy: $event })"
                  ></v-select>
                </v-col>

                <v-col cols="12" md="6">
                  <v-select
                    v-model="localFilters.sortOrder"
                    :items="orderOptions"
                    label="Order"
                    variant="outlined"
                    density="compact"
                    @update:model-value="updateFilters({ sortOrder: $event })"
                  ></v-select>
                </v-col>
              </v-row>

              <!-- Date Presets -->
              <div class="mt-4">
                <h4 class="text-subtitle-1 mb-2">Quick Date Ranges</h4>
                <div class="d-flex flex-wrap gap-2">
                  <v-btn
                    v-for="preset in datePresets"
                    :key="preset.name"
                    size="small"
                    variant="outlined"
                    @click="applyDatePreset(preset)"
                  >
                    {{ preset.name }}
                  </v-btn>
                </div>
              </div>
            </v-card-text>
          </div>
        </v-expand-transition>
      </v-card-text>
    </v-card>

    <!-- Active Filter Chips -->
    <div v-if="taskStore.activeFilterChips.length > 0" class="mb-4">
      <div class="d-flex align-center mb-2">
        <v-icon left color="primary">mdi-filter</v-icon>
        <span class="text-subtitle-2">Active Filters</span>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <v-chip
          v-for="chip in taskStore.activeFilterChips"
          :key="chip.key"
          closable
          variant="flat"
          color="primary"
          @click:close="taskStore.removeFilter(chip.key)"
        >
          {{ chip.label }}
        </v-chip>
      </div>
    </div>

    <!-- Results Summary -->
    <div class="mb-4">
      <v-card variant="tonal" color="info">
        <v-card-text class="py-2">
          <div class="d-flex align-center">
            <v-icon left>mdi-information</v-icon>
            <span>
              Showing {{ taskStore.tasks.length }} of
              {{ taskStore.pagination.total }} tasks
              <span v-if="taskStore.activeFilterCount > 0">
                ({{ taskStore.activeFilterCount }} filters applied)
              </span>
            </span>
            <v-spacer></v-spacer>
            <slot name="export-actions"></slot>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Export Modal -->
    <export-modal v-model="showExportModal" />
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../constants/taskEnums.js'
import ExportModal from './ExportModal.vue'

const taskStore = useTaskStore()

const showAdvanced = ref(false)
const showExportModal = ref(false)

// Local filters for v-model binding
const localFilters = reactive({
  status: [],
  priority: [],
  text: '',
  createdFrom: null,
  createdTo: null,
  completedFrom: null,
  completedTo: null,
  sortBy: 'createdAt',
  sortOrder: 'desc'
})

// Options for selects
const statusOptions = STATUS_OPTIONS
const priorityOptions = PRIORITY_OPTIONS

const sortOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Title', value: 'title' },
  { title: 'Priority', value: 'priority' },
  { title: 'Status', value: 'status' }
]

const orderOptions = [
  { title: 'Newest First', value: 'desc' },
  { title: 'Oldest First', value: 'asc' }
]

// Date presets for quick filtering
const datePresets = [
  {
    name: 'Today',
    filters: {
      createdFrom: new Date().toISOString().split('T')[0],
      createdTo: new Date().toISOString().split('T')[0]
    }
  },
  {
    name: 'This Week',
    filters: {
      createdFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      createdTo: new Date().toISOString().split('T')[0]
    }
  },
  {
    name: 'This Month',
    filters: {
      createdFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0],
      createdTo: new Date().toISOString().split('T')[0]
    }
  },
  {
    name: 'Last 30 Days',
    filters: {
      createdFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      createdTo: new Date().toISOString().split('T')[0]
    }
  }
]

// Watch store filters and sync with local filters
watch(
  () => taskStore.filters,
  (newFilters) => {
    Object.assign(localFilters, newFilters)
  },
  { deep: true, immediate: true }
)

// Update filters with debouncing
let debounceTimeout = null
const updateFilters = (updates) => {
  Object.assign(localFilters, updates)

  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }

  debounceTimeout = setTimeout(() => {
    taskStore.updateFilters(updates)
  }, 300)
}

// Apply date preset
const applyDatePreset = (preset) => {
  updateFilters(preset.filters)
}

// Color helpers for chips
const getStatusChipColor = (status) => {
  const colors = {
    pending: 'orange',
    'in-progress': 'blue',
    completed: 'green'
  }
  return colors[status] || 'grey'
}

const getPriorityChipColor = (priority) => {
  const colors = {
    low: 'green',
    medium: 'orange',
    high: 'red'
  }
  return colors[priority] || 'grey'
}

onMounted(() => {
  // Initialize filters from store
  Object.assign(localFilters, taskStore.filters)
})
</script>

<style scoped>
.filter-bar {
  margin-bottom: 1rem;
}

.gap-2 > * {
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
}

.gap-2 > *:last-child {
  margin-right: 0;
}
</style>
