<template>
  <div :class="['glass-card', { 'glass-card--glow': glow }, customClass]">
    <div v-if="$slots.header" class="glass-card__header">
      <slot name="header" />
    </div>
    <div class="glass-card__body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  glow: {
    type: Boolean,
    default: false
  },
  customClass: {
    type: String,
    default: ''
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.glass-card {
  @include glass-card;
  overflow: hidden;

  &--glow {
    box-shadow: $glow;
  }

  &__header {
    padding: 18px 24px;
    border-bottom: 1px solid $border-subtle;
    font-weight: 600;
    font-size: 15px;
    color: $text;
  }

  &__body {
    padding: 24px;
  }
}
</style>
