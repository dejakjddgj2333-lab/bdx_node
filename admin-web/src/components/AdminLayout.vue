<template>
  <div class="admin-layout">
    <SideNav :collapsed="collapsed" />
    <div :class="['admin-layout__main', { 'is-collapsed': collapsed }]">
      <header class="admin-header">
        <button class="toggle-btn" @click="collapsed = !collapsed">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h2 class="admin-header__title">{{ routeTitle }}</h2>
        <div class="admin-header__user">
          <span class="user-avatar">A</span>
          <span class="user-name">{{ adminStore.adminInfo?.username || 'Admin' }}</span>
        </div>
      </header>
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import SideNav from './SideNav.vue'

const route = useRoute()
const adminStore = useAdminStore()
const collapsed = ref(false)

const routeTitle = computed(() => route.meta?.title || '后台管理')
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.admin-layout {
  display: flex;
  min-height: 100vh;
  background: $bg;

  &__main {
    flex: 1;
    margin-left: $sidebar-width;
    display: flex;
    flex-direction: column;
    transition: margin-left 0.25s ease;

    &.is-collapsed {
      margin-left: 72px;
    }
  }
}

.admin-header {
  height: $header-height;
  background: $bg-elevated;
  border-bottom: 1px solid $border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 90;

  .toggle-btn {
    background: $bg-hover;
    border: 1px solid $border;
    color: $text-secondary;
    width: 36px;
    height: 36px;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba($primary, 0.08);
      color: $primary;
    }
  }

  &__title {
    flex: 1;
    margin: 0 16px;
    font-size: 18px;
    font-weight: 600;
    color: $text;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 10px;

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: $primary;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
    }

    .user-name {
      font-size: 14px;
      color: $text-secondary;
    }
  }
}

.admin-content {
  flex: 1;
  padding: 24px;
  overflow-x: hidden;
}
</style>
