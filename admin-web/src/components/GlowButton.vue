<template>
  <button
    :type="type"
    :class="['glow-button', `glow-button--${variant}`, `glow-button--${size}`, { 'is-loading': loading } ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="glow-button__spinner" />
    <slot />
  </button>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'button'
  },
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use "sass:color";

.glow-button {
  @include btn-primary;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 20px;
  height: 40px;
  font-size: 14px;

  &--secondary {
    background: $bg-elevated;
    color: $text;
    border-color: $border;
    box-shadow: none;

    &:hover {
      background: $bg-hover;
      border-color: $border;
      box-shadow: none;
    }
  }

  &--danger {
    background: $pink;
    box-shadow: 0 2px 8px rgba($pink, 0.2);

    &:hover {
      background: color.adjust($pink, $lightness: -8%);
      box-shadow: 0 4px 12px rgba($pink, 0.3);
    }
  }

  &--sm {
    height: 32px;
    padding: 0 14px;
    font-size: 13px;
  }

  &--lg {
    height: 48px;
    padding: 0 28px;
    font-size: 15px;
  }

  &__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
