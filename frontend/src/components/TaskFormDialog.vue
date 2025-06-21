<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>
        {{ isEdit ? 'Edit Task' : 'Create New Task' }}
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="valid" @submit.prevent="save">
          <v-text-field
            v-model="formData.title"
            label="Title"
            :rules="titleRules"
            required
            autofocus
            counter="200"
            variant="outlined"
            class="mb-3"
          ></v-text-field>

          <v-textarea
            v-model="formData.description"
            label="Description"
            rows="3"
            counter="1000"
            variant="outlined"
            class="mb-3"
          ></v-textarea>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="formData.priority"
                :items="priorityOptions"
                label="Priority"
                :rules="priorityRules"
                required
                variant="outlined"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="formData.status"
                :items="statusOptions"
                label="Status"
                :rules="statusRules"
                required
                variant="outlined"
              ></v-select>
            </v-col>
          </v-row>

          <v-text-field
            v-model.number="formData.estimatedTime"
            label="Estimated Time (hours)"
            type="number"
            min="0"
            step="0.5"
            variant="outlined"
            class="mb-3"
          ></v-text-field>

          <v-text-field
            v-if="isEdit && formData.status === 'completed'"
            v-model.number="formData.actualTime"
            label="Actual Time (hours)"
            type="number"
            min="0"
            step="0.5"
            variant="outlined"
            class="mb-3"
          ></v-text-field>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="cancel">Cancel</v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!valid"
          @click="save"
        >
          {{ isEdit ? 'Update' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '../constants/taskEnums.js'

const props = defineProps({
  modelValue: Boolean,
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const taskStore = useTaskStore()
const form = ref(null)
const valid = ref(false)
const loading = ref(false)

const isEdit = computed(() => !!props.task)

const formData = reactive({
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  estimatedTime: null,
  actualTime: null
})

const priorityOptions = PRIORITY_OPTIONS
const statusOptions = STATUS_OPTIONS

const titleRules = [
  (v) => !!v || 'Title is required',
  (v) => (v && v.length <= 200) || 'Title must be less than 200 characters'
]

const priorityRules = [(v) => !!v || 'Priority is required']

const statusRules = [(v) => !!v || 'Status is required']

watch(
  () => props.task,
  (newTask) => {
    if (newTask) {
      Object.assign(formData, {
        title: newTask.title || '',
        description: newTask.description || '',
        priority: newTask.priority || 'medium',
        status: newTask.status || 'pending',
        estimatedTime: newTask.estimatedTime || null,
        actualTime: newTask.actualTime || null
      })
    }
  },
  { immediate: true }
)

watch(
  () => props.modelValue,
  (show) => {
    if (show && !props.task) {
      resetForm()
    }
  }
)

function resetForm() {
  Object.assign(formData, {
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    estimatedTime: null,
    actualTime: null
  })
  if (form.value) {
    form.value.resetValidation()
  }
}

function cancel() {
  emit('update:modelValue', false)
  resetForm()
}

async function save() {
  if (!form.value?.validate()) return

  loading.value = true

  try {
    const taskData = { ...formData }

    if (taskData.estimatedTime === '') taskData.estimatedTime = null
    if (taskData.actualTime === '') taskData.actualTime = null

    if (isEdit.value) {
      await taskStore.updateTask(props.task._id, taskData)
    } else {
      await taskStore.createTask(taskData)
    }

    emit('save')
    resetForm()
  } catch (error) {
    console.error('Error saving task:', error)
  } finally {
    loading.value = false
  }
}
</script>
