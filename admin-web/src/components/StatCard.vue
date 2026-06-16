<template>
  <GlassCard glow class="stat-card">
    <div class="stat-card__icon">
      <slot name="icon" />
    </div>
    <div class="stat-card__content">
      <div class="stat-card__value">{{ value }}</div>
      <div class="stat-card__title">{{ title }}</div>
    </div>
  </GlassCard>
</template>

<script setup>
import GlassCard from './GlassCard.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;

  :deep(.glass-card__body) {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  &__icon {
    width: 52px;
    height: 52px;
    border-radius: $radius-md;
    background: rgba($primary, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    color: $primary;
    flex-shrink: 0;
  }

  &__value {
    font-size: 28px;
    font-weight: 700;
    color: $text;
    line-height: 1.2;
  }

  &__title {
    font-size: 13px;
    color: $text-secondary;
    margin-top: 4px;
  }
}
</style>
