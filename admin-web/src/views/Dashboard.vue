<template>
  <div class="dashboard-page fade-in">
    <h1 class="page-title">数据概览</h1>

    <div class="stats-grid">
      <StatCard title="总用户数" :value="stats.usersTotal">
        <template #icon>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </template>
      </StatCard>

      <StatCard title="会话总数" :value="stats.conversationsTotal">
        <template #icon>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </template>
      </StatCard>

      <StatCard title="消息总数" :value="stats.messagesTotal">
        <template #icon>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        </template>
      </StatCard>

      <StatCard title="文档总数" :value="stats.documentsTotal">
        <template #icon>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </template>
      </StatCard>

      <StatCard title="启用模型" :value="stats.activeModels">
        <template #icon>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </template>
      </StatCard>

      <StatCard title="活跃 Provider" :value="stats.activeProviders">
        <template #icon>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </template>
      </StatCard>
    </div>

    <div class="dashboard-grid">
      <GlassCard class="recent-panel">
        <template #header>最近注册用户</template>
        <div v-if="stats.recentUsers?.length">
          <div
            v-for="user in stats.recentUsers"
            :key="user.id"
            class="recent-item"
          >
            <div class="recent-item__info">
              <div class="recent-item__title">{{ user.nickname || user.username }}</div>
              <div class="recent-item__meta">{{ user.username }}</div>
            </div>
            <div class="recent-item__time">{{ formatDate(user.created_at) }}</div>
          </div>
        </div>
        <div v-else class="empty-text">暂无数据</div>
      </GlassCard>

      <GlassCard class="recent-panel">
        <template #header>最近上传文档</template>
        <div v-if="stats.recentDocuments?.length">
          <div
            v-for="doc in stats.recentDocuments"
            :key="doc.id"
            class="recent-item"
          >
            <div class="recent-item__info">
              <div class="recent-item__title">{{ doc.original_name }}</div>
              <div class="recent-item__meta">{{ doc.knowledge_base_name || '未归类' }} · {{ doc.parse_status }}</div>
            </div>
            <div class="recent-item__time">{{ formatDate(doc.created_at) }}</div>
          </div>
        </div>
        <div v-else class="empty-text">暂无数据</div>
      </GlassCard>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import StatCard from '@/components/StatCard.vue'

const stats = ref({
  usersTotal: 0,
  conversationsTotal: 0,
  messagesTotal: 0,
  documentsTotal: 0,
  activeModels: 0,
  activeProviders: 0,
  recentUsers: [],
  recentDocuments: []
})

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadStats() {
  try {
    stats.value = await adminApi.stats()
  } catch (e) {
    console.error('加载统计数据失败:', e)
  }
}

onMounted(loadStats)
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
}

.recent-panel {
  :deep(.glass-card__body) {
    min-height: 200px;
  }
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid $border-subtle;

  &:last-child {
    border-bottom: none;
  }

  &__title {
    font-size: 14px;
    color: $text;
    margin-bottom: 4px;
  }

  &__meta {
    font-size: 12px;
    color: $text-tertiary;
  }

  &__time {
    font-size: 12px;
    color: $text-secondary;
    white-space: nowrap;
  }
}

.empty-text {
  color: $text-tertiary;
  text-align: center;
  padding: 40px 0;
}
</style>
