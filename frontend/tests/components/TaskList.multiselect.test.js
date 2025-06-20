import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import TaskList from '../../src/components/TaskList.vue'
import { useTaskStore } from '../../src/stores/taskStore.js'

// Mock the task store
vi.mock('../../src/stores/taskStore.js', () => ({
  useTaskStore: vi.fn()
}))

// Mock the TaskFormDialog component
vi.mock('../../src/components/TaskFormDialog.vue', () => ({
  default: { template: '<div class="task-form-dialog"></div>' }
}))

// Mock Vuetify components for multi-select
const VSelect = {
  template: `
    <div class="v-select" :class="{'multiple': multiple}">
      <div v-if="multiple && chips && Array.isArray(modelValue)" class="chips-container">
        <span v-for="item in modelValue" :key="item" class="chip">{{ item }}</span>
      </div>
      <input 
        :value="multiple ? (Array.isArray(modelValue) ? modelValue.join(',') : '') : modelValue" 
        @input="$emit('update:model-value', multiple ? $event.target.value.split(',').filter(v => v) : $event.target.value)"
        data-testid="select-input"
      />
    </div>
  `,
  props: ['modelValue', 'items', 'label', 'multiple', 'chips', 'clearable'],
  emits: ['update:model-value']
}

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

describe('TaskList Multi-Select Functionality', () => {
  let mockTaskStore

  beforeEach(() => {
    setActivePinia(createPinia())

    mockTaskStore = {
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
        },
        {
          _id: '3',
          title: 'Task 3',
          status: 'in-progress',
          priority: 'low',
          createdAt: new Date()
        }
      ],
      loading: false,
      error: null,
      pagination: { page: 1, limit: 10, total: 3, pages: 1 },
      updateFilters: vi.fn(),
      fetchTasks: vi.fn(),
      deleteTask: vi.fn(),
      setPage: vi.fn()
    }

    useTaskStore.mockReturnValue(mockTaskStore)
  })

  it('should render status filter as multi-select with chips', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    await wrapper.vm.$nextTick()

    // Check that the select elements exist
    const statusSelect = wrapper.findAll('.v-select')[0]
    expect(statusSelect.exists()).toBe(true)

    // Check that the input element exists
    const selectElement = statusSelect.find('input[data-testid="select-input"]')
    expect(selectElement.exists()).toBe(true)

    // Check that the status filter starts with empty array
    expect(wrapper.vm.filters.status).toEqual([])
  })

  it('should render priority filter as multi-select with chips', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    await wrapper.vm.$nextTick()

    // Check that the select elements exist
    const prioritySelect = wrapper.findAll('.v-select')[1]
    expect(prioritySelect.exists()).toBe(true)

    // Check that the input element exists
    const selectElement = prioritySelect.find(
      'input[data-testid="select-input"]'
    )
    expect(selectElement.exists()).toBe(true)

    // Check that the priority filter starts with empty array
    expect(wrapper.vm.filters.priority).toEqual([])
  })

  it('should initialize filters with empty arrays', () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    // Access the component's data
    const vm = wrapper.vm
    expect(vm.filters.status).toEqual([])
    expect(vm.filters.priority).toEqual([])
  })

  it('should call updateFilters when status selection changes', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    const statusSelect = wrapper.findAll('.v-select')[0]
    const input = statusSelect.find('[data-testid="select-input"]')

    await input.setValue('pending,completed')
    await input.trigger('input')

    expect(mockTaskStore.updateFilters).toHaveBeenCalled()
  })

  it('should call updateFilters when priority selection changes', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    const prioritySelect = wrapper.findAll('.v-select')[1]
    const input = prioritySelect.find('[data-testid="select-input"]')

    await input.setValue('high,medium')
    await input.trigger('input')

    expect(mockTaskStore.updateFilters).toHaveBeenCalled()
  })

  it('should display chips for selected status values', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    // Wait for initial render
    await wrapper.vm.$nextTick()

    // Directly set the filter values (simulating user selection)
    wrapper.vm.filters.status = ['pending', 'completed']

    // Trigger reactivity update
    await wrapper.vm.$nextTick()

    // Check that the filter values are set correctly
    expect(wrapper.vm.filters.status).toEqual(['pending', 'completed'])

    // Check that the mock VSelect would show chips
    const statusSelect = wrapper.findAll('.v-select')[0]
    expect(statusSelect.exists()).toBe(true)

    // Since we're testing the mock component behavior, let's verify the input value
    const input = statusSelect.find('input[data-testid="select-input"]')
    expect(input.element.value).toBe('pending,completed')
  })

  it('should display chips for selected priority values', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    // Wait for initial render
    await wrapper.vm.$nextTick()

    // Directly set the filter values (simulating user selection)
    wrapper.vm.filters.priority = ['high', 'low']

    // Trigger reactivity update
    await wrapper.vm.$nextTick()

    // Check that the filter values are set correctly
    expect(wrapper.vm.filters.priority).toEqual(['high', 'low'])

    // Check that the mock VSelect would show chips
    const prioritySelect = wrapper.findAll('.v-select')[1]
    expect(prioritySelect.exists()).toBe(true)

    // Since we're testing the mock component behavior, let's verify the input value
    const input = prioritySelect.find('input[data-testid="select-input"]')
    expect(input.element.value).toBe('high,low')
  })

  it('should use STATUS_OPTIONS and PRIORITY_OPTIONS constants', () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    const vm = wrapper.vm

    // Check that statusOptions includes all expected values
    expect(vm.statusOptions).toEqual([
      { title: 'Pending', value: 'pending' },
      { title: 'In Progress', value: 'in-progress' },
      { title: 'Completed', value: 'completed' }
    ])

    // Check that priorityOptions includes all expected values
    expect(vm.priorityOptions).toEqual([
      { title: 'Low', value: 'low' },
      { title: 'Medium', value: 'medium' },
      { title: 'High', value: 'high' }
    ])
  })

  it('should maintain filter state between updates', async () => {
    const wrapper = mount(TaskList, {
      global: { plugins: [vuetify] }
    })

    const vm = wrapper.vm

    // Set initial filters
    vm.filters.status = ['pending']
    vm.filters.priority = ['high', 'medium']

    // Update filters
    vm.updateFilters()

    // Verify filters are maintained
    expect(vm.filters.status).toEqual(['pending'])
    expect(vm.filters.priority).toEqual(['high', 'medium'])
    expect(mockTaskStore.updateFilters).toHaveBeenCalledWith({
      status: ['pending'],
      priority: ['high', 'medium'],
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  })
})
