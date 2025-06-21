<template>
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    temporary
    width="400"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-toolbar color="primary" dark>
      <v-toolbar-title>Notifications</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon title="Clear all" @click="$emit('clear-all')">
        <v-icon>mdi-delete-sweep</v-icon>
      </v-btn>
      <v-btn icon @click="$emit('update:modelValue', false)">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>

    <div v-if="notifications.length === 0" class="pa-4 text-center">
      <v-icon size="64" color="grey-lighten-1">mdi-bell-outline</v-icon>
      <p class="text-grey mt-2">No notifications</p>
    </div>

    <v-list v-else>
      <v-list-item
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-item"
      >
        <template #prepend>
          <v-icon :color="getNotificationColor(notification.type)">
            {{ getNotificationIcon(notification.type) }}
          </v-icon>
        </template>

        <v-list-item-title>{{ notification.message }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ formatTimestamp(notification.timestamp) }}
        </v-list-item-subtitle>

        <template #append>
          <v-btn icon size="small" @click="$emit('remove', notification.id)">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
defineProps({
  modelValue: Boolean,
  notifications: {
    type: Array,
    default: () => []
  }
})

defineEmits(['update:modelValue', 'clear-all', 'remove'])

function getNotificationIcon(type) {
  switch (type) {
    case 'error':
      return 'mdi-alert-circle'
    case 'warning':
      return 'mdi-alert'
    case 'success':
      return 'mdi-check-circle'
    default:
      return 'mdi-information'
  }
}

function getNotificationColor(type) {
  switch (type) {
    case 'error':
      return 'error'
    case 'warning':
      return 'warning'
    case 'success':
      return 'success'
    default:
      return 'info'
  }
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<style scoped>
.notification-item {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}
</style>
