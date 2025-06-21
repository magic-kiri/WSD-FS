<template>
  <v-card class="metric-card" height="120" elevation="2">
    <v-card-text class="d-flex align-center">
      <div class="flex-grow-1">
        <div class="metric-value" :class="`text-${color}`">
          {{ value }}
        </div>
        <div class="metric-label">{{ title }}</div>
      </div>
      <v-icon :color="color" size="48" class="ml-3 metric-icon">
        {{ icon }}
      </v-icon>
    </v-card-text>
  </v-card>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: 'primary'
  }
})
</script>

<style scoped>
.metric-card {
  transition: all 0.3s ease;
  cursor: pointer;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
}

.metric-value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
}

.metric-label {
  font-size: 0.875rem;
  color: rgba(0,0,0,0.6);
  font-weight: 500;
  margin-top: 4px;
}

.metric-icon {
  transition: transform 0.3s ease;
}

.metric-card:hover .metric-icon {
  transform: scale(1.1);
}
</style>
