<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="onClose">
        <div class="modal" :style="{ width }">
          <div class="modal__header">
            <h3 class="modal__title">{{ title }}</h3>
            <button class="modal__close" @click="onClose">×</button>
          </div>
          <div class="modal__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  width: {
    type: String,
    default: '480px'
  }
})

const emit = defineEmits(['update:visible', 'close'])

function onClose() {
  emit('update:visible', false)
  emit('close')
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  @include glass-card;
  width: 100%;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid $border-subtle;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: $text;
  }

  &__close {
    background: none;
    border: none;
    color: $text-tertiary;
    font-size: 24px;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: $radius-md;

    &:hover {
      background: $bg-hover;
      color: $text;
    }
  }

  &__body {
    padding: 24px;
    overflow-y: auto;
  }

  &__footer {
    padding: 16px 24px;
    border-top: 1px solid $border-subtle;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;

  .modal {
    transition: transform 0.25s ease;
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal {
    transform: scale(0.96) translateY(10px);
  }
}
</style>
