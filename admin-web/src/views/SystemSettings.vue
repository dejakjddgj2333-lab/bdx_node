<template>
  <div class="system-settings-page fade-in">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
    </div>

    <GlassCard class="section">
      <template #header>全局配置</template>
      <DataTable :columns="columns" :data="settings" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'value'">
            <input
              v-if="row.type === 'number'"
              :value="row.value"
              type="number"
              class="inline-input inline-input--md"
              @blur="updateSetting(row, $event.target.value)"
            />
            <label v-else-if="row.type === 'boolean'" class="switch">
              <input
                type="checkbox"
                :checked="row.value === 'true'"
                @change="updateSetting(row, $event.target.checked ? 'true' : 'false')"
              />
              <span class="switch__slider" />
            </label>
            <input
              v-else
              :value="row.value"
              class="inline-input inline-input--md"
              @blur="updateSetting(row, $event.target.value)"
            />
          </span>
          <span v-else-if="column.key === 'key'" class="setting-key">{{ row[column.key] }}</span>
          <span v-else-if="column.key === 'description'" class="setting-desc">{{ row[column.key] }}</span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>
    </GlassCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import DataTable from '@/components/DataTable.vue'

const columns = [
  { key: 'key', title: '配置项', width: '260px' },
  { key: 'description', title: '说明' },
  { key: 'value', title: '值', width: '280px', align: 'center' }
]

const settings = ref([])
const loading = ref(false)

const knownSettings = {
  default_daily_image_quota: { type: 'number', description: '默认每日图片生成次数' },
  image_generation_enabled: { type: 'boolean', description: '是否启用图片生成功能' }
}

async function loadSettings() {
  loading.value = true
  try {
    const rows = await adminApi.getSystemSettings()
    const orderedKeys = Object.keys(knownSettings)
    const orderedRows = orderedKeys
      .map(key => {
        const row = rows.find(r => r.key === key)
        if (!row) return null
        const meta = knownSettings[key] || { type: 'text', description: row.description || '' }
        return { ...row, ...meta }
      })
      .filter(Boolean)
    settings.value = orderedRows
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

async function updateSetting(row, value) {
  try {
    await adminApi.updateSystemSetting(row.key, value)
    loadSettings()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(loadSettings)
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.system-settings-page {
  padding-bottom: 32px;
}

.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: $text;
    margin: 0;
    letter-spacing: -0.02em;
  }
}

.section {
  margin-bottom: 24px;
}

.setting-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: $text-secondary;
  background: rgba($text-tertiary, 0.08);
  padding: 2px 8px;
  border-radius: $radius-sm;
}

.setting-desc {
  color: $text-secondary;
  font-size: 13px;
}

.inline-input {
  padding: 6px 10px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text;
  background: $bg-card;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &--md {
    width: 220px;
  }

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $border-focus;
  }
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  &__slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: $border;
    border-radius: $radius-pill;
    transition: background 0.2s ease;

    &::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 20px;
      height: 20px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }
  }

  input:checked + &__slider {
    background: $success;
  }

  input:checked + &__slider::before {
    transform: translateX(20px);
  }
}
</style>
