<template>
  <aside :class="['side-nav', { 'is-collapsed': collapsed }]">
    <div class="side-nav__brand">
      <div class="brand-logo">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#brand-gradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <defs>
            <linearGradient id="brand-gradient" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
              <stop stop-color="#6366f1" />
              <stop offset="1" stop-color="#4f46e5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span v-if="!collapsed" class="brand-name">北斗星AI</span>
    </div>

    <nav class="side-nav__menu">
      <a
        v-for="item in menu"
        :key="item.name"
        :class="['menu-item', { 'is-active': $route.name === item.name }]"
        @click="$router.push({ name: item.name })"
      >
        <span class="menu-item__icon" v-html="item.icon" />
        <span v-if="!collapsed" class="menu-item__title">{{ item.title }}</span>
      </a>
    </nav>

    <div class="side-nav__footer">
      <a class="menu-item" @click="handleLogout">
        <span class="menu-item__icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </span>
        <span v-if="!collapsed" class="menu-item__title">退出登录</span>
      </a>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

const icons = {
  dashboard: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>`,
  users: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>`,
  knowledge: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>`,
  model: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>`,
  sparkle: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" />
  </svg>`,
  image: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>`,
  settings: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>`
}

const menu = computed(() => [
  { name: 'Dashboard', title: '数据概览', icon: icons.dashboard },
  { name: 'UserManage', title: '用户管理', icon: icons.users },
  { name: 'KnowledgeBase', title: '知识库', icon: icons.knowledge },
  { name: 'ModelConfig', title: '模型配置', icon: icons.model },
  { name: 'ImageModelConfig', title: '绘图模型', icon: icons.image },
  { name: 'SystemSettings', title: '系统设置', icon: icons.settings },
  { name: 'PromptSuggestions', title: '推荐语配置', icon: icons.sparkle }
])

async function handleLogout() {
  try {
    await adminStore.logout()
  } catch (e) {}
  router.push('/login')
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.side-nav {
  width: $sidebar-width;
  height: 100vh;
  background: $bg-elevated;
  border-right: 1px solid $border;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  transition: width 0.25s ease;

  &.is-collapsed {
    width: 72px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px;
    border-bottom: 1px solid $border-subtle;
  }

  .brand-logo {
    width: 40px;
    height: 40px;
    border-radius: $radius-md;
    background: rgba($primary, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .brand-name {
    font-size: 18px;
    font-weight: 700;
    color: $text;
    white-space: nowrap;
  }

  &__menu {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__footer {
    padding: 16px 12px;
    border-top: 1px solid $border-subtle;
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: $radius-md;
  color: $text-secondary;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;

  &__icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  &:hover {
    background: $bg-hover;
    color: $text;
  }

  &.is-active {
    background: rgba($primary, 0.08);
    color: $primary;
    box-shadow: inset 3px 0 0 $primary;
  }
}
</style>
