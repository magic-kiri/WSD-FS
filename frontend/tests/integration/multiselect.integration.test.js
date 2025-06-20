import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import TaskList from '../../src/components/TaskList.vue'
import { useTaskStore } from '../../src/stores/taskStore.js'
import apiClient from '../../src/api/client.js'

// Mock the API client
vi.mock('../../src/api/client.js', () => ({
  default: {
    getTasks: vi.fn()
  }
}))

// Mock the TaskFormDialog component
vi.mock('../../src/components/TaskFormDialog.vue', () => ({
  default: { template: '<div class="task-form-dialog"></div>' }
}))

// Mock Vuetify components with realistic multi-select behavior
const VSelect = {
  template: `
    <div class="v-select" :class="{'multiple': multiple}">
      <div v-if="multiple && chips" class="chips-container">
        <span v-for="item in modelValue" :key="item" class="chip">{{ getOptionTitle(item) }}</span>
      </div>
      <select 
        :multiple="multiple"
        :value="modelValue" 
        @change="handleChange"
        data-testid="select-element"
        ref="selectElement"
      >
        <option v-for="item in items" :key="item.value" :value="item.value">
          {{ item.title }}
        </option>
      </select>
    </div>
  `,
  props: ['modelValue', 'items', 'label', 'multiple', 'chips', 'clearable'],
  emits: ['update:model-value'],
  methods: {
    getOptionTitle(value) {
      const option = this.items.find((item) => item.value === value)
      return option ? option.title : value
    },
    handleChange(event) {
      if (this.multiple) {
        // Check if selectedOptions is available (set by test)
        const selectElement = event.target
        if (
          selectElement.selectedOptions &&
          selectElement.selectedOptions.length >= 0
        ) {
          const values = Array.from(selectElement.selectedOptions).map(
            (opt) => opt.value
          )
          this.$emit('update:model-value', values)
        } else {
          // Fallback to regular value handling
          const values = Array.from(event.target.selectedOptions || []).map(
            (opt) => opt.value
          )
          this.$emit('update:model-value', values)
        }
      } else {
        this.$emit('update:model-value', event.target.value)
      }
    }
  }
}

// Mock other Vuetify components
const VCard = { template: '<div class="v-card"><slot /></div>' }
const VCardText = { template: '<div class="v-card-text"><slot /></div>' }
const VRow = { template: '<div class="v-row"><slot /></div>' }
const VCol = { template: '<div class="v-col"><slot /></div>' }
const VBtn = { template: '<button class="v-btn"><slot /></button>' }
const VIcon = { template: '<i class="v-icon"><slot /></i>' }
const VProgressCircular = {
  template: '<div class="v-progress-circular"></div>'
}
const VAlert = { template: '<div class="v-alert"><slot /></div>' }
const VPagination = { template: '<div class="v-pagination"></div>' }
const VDialog = { template: '<div class="v-dialog"><slot /></div>' }
const VCardTitle = { template: '<div class="v-card-title"><slot /></div>' }
const VCardActions = { template: '<div class="v-card-actions"><slot /></div>' }
const VSpacer = { template: '<div class="v-spacer"></div>' }
const VChip = { template: '<span class="v-chip"><slot /></span>' }
const VMenu = { template: '<div class="v-menu"><slot /></div>' }
const VList = { template: '<div class="v-list"><slot /></div>' }
const VListItem = { template: '<div class="v-list-item"><slot /></div>' }
const VListItemTitle = {
  template: '<div class="v-list-item-title"><slot /></div>'
}

const vuetify = {
  install(app) {
    app.component('VSelect', VSelect)
    app.component('VCard', VCard)
    app.component('VCardText', VCardText)
    app.component('VRow', VRow)
    app.component('VCol', VCol)
    app.component('VBtn', VBtn)
    app.component('VIcon', VIcon)
    app.component('VProgressCircular', VProgressCircular)
    app.component('VAlert', VAlert)
    app.component('VPagination', VPagination)
    app.component('VDialog', VDialog)
    app.component('VCardTitle', VCardTitle)
    app.component('VCardActions', VCardActions)
    app.component('VSpacer', VSpacer)
    app.component('VChip', VChip)
    app.component('VMenu', VMenu)
    app.component('VList', VList)
    app.component('VListItem', VListItem)
    app.component('VListItemTitle', VListItemTitle)
  }
}

describe('Multi-Select Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Mock successful API response
    apiClient.getTasks.mockResolvedValue({
      data: {
        tasks: [
          {
            _id: '1',
            title: 'Task 1',
            status: 'pending',
            priority: 'high',
            createdAt: new Date()
          },
          {
            _id: '2',
            title: 'Task 2',
            status: 'completed',
            priority: 'medium',
            createdAt: new Date()
          }
        ],
        pagination: { page: 1, limit: 10, total: 2, pages: 1 }
      }
    })
  })

  describe('End-to-End Multi-Select Flow', () => {
    it('should complete full flow: select multiple statuses → update filters → call API', async () => {
      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // Directly set the filter values (simulating user selection)
      wrapper.vm.filters.status = ['pending', 'completed']

      // Trigger the update
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      // Verify the API was called with correct parameters
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: ['pending', 'completed'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should complete full flow: select multiple priorities → update filters → call API', async () => {
      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // Directly set the filter values (simulating user selection)
      wrapper.vm.filters.priority = ['high', 'medium']

      // Trigger the update
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      // Verify the API was called with correct parameters
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        priority: ['high', 'medium'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should handle combined status and priority selections', async () => {
      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // Set combined filters
      wrapper.vm.filters.status = ['pending', 'in-progress']
      wrapper.vm.filters.priority = ['high']

      // Trigger the update
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      // Verify the API was called with combined filters
      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: ['pending', 'in-progress'],
        priority: ['high'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })
  })

  describe('URL Parameter Generation', () => {
    it('should generate correct URL parameters for multiple selections', async () => {
      // Simulate what the API client would receive
      const params = {
        status: ['pending', 'completed'],
        priority: ['high', 'medium'],
        page: 1,
        limit: 10
      }

      // Simulate URL parameter generation
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, item))
        } else if (value !== null && value !== undefined && value !== '') {
          searchParams.append(key, value)
        }
      })

      const expectedUrl =
        'status=pending&status=completed&priority=high&priority=medium&page=1&limit=10'
      expect(searchParams.toString()).toBe(expectedUrl)
    })

    it('should handle empty arrays correctly in URL generation', async () => {
      const params = {
        status: [],
        priority: ['high'],
        page: 1,
        limit: 10
      }

      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, item))
        } else if (value !== null && value !== undefined && value !== '') {
          searchParams.append(key, value)
        }
      })

      const expectedUrl = 'priority=high&page=1&limit=10'
      expect(searchParams.toString()).toBe(expectedUrl)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle user selecting all statuses', async () => {
      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // Set all status values
      wrapper.vm.filters.status = ['pending', 'in-progress', 'completed']

      // Trigger the update
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      expect(apiClient.getTasks).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: ['pending', 'in-progress', 'completed'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should handle user clearing all selections', async () => {
      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // First set some filters
      wrapper.vm.filters.status = ['pending']
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      // Then clear them
      wrapper.vm.filters.status = []
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      expect(apiClient.getTasks).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })

    it('should handle rapid filter changes correctly', async () => {
      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // Rapid changes
      wrapper.vm.filters.status = ['pending']
      wrapper.vm.updateFilters()

      wrapper.vm.filters.status = ['pending', 'completed']
      wrapper.vm.updateFilters()

      wrapper.vm.filters.status = ['completed']
      wrapper.vm.updateFilters()

      await wrapper.vm.$nextTick()

      // Should call API for each change (initial mount + 3 changes)
      expect(apiClient.getTasks).toHaveBeenCalledTimes(4)
      expect(apiClient.getTasks).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        status: ['completed'],
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully during multi-select', async () => {
      // Mock API failure
      apiClient.getTasks.mockRejectedValue(new Error('Network error'))

      const wrapper = mount(TaskList, {
        global: { plugins: [vuetify] }
      })

      await wrapper.vm.$nextTick()

      // Set filters and trigger update
      wrapper.vm.filters.status = ['pending']
      wrapper.vm.updateFilters()
      await wrapper.vm.$nextTick()

      // Should still attempt the API call
      expect(apiClient.getTasks).toHaveBeenCalled()

      // Component should handle the error (specific error handling would depend on implementation)
      const taskStore = useTaskStore()
      expect(taskStore.error).toBeTruthy()
    })
  })
})
