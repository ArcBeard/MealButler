<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <!-- Bowler hat crown -->
    <path d="M7.5 10c0-3.5 2-6 4.5-6s4.5 2.5 4.5 6h-9z" />
    <!-- Hat brim -->
    <rect x="5" y="9.5" width="14" height="2.5" rx="1.25" />
    <!-- Head -->
    <circle cx="12" cy="16" r="3.5" />
    <!-- Bow tie -->
    <path d="M9 20.5L12 19l3 1.5-3 1.5z" />
  </svg>
</template>
