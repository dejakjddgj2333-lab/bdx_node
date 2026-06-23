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
              class="inline-input"
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
              class="inline-input"
              @blur="updateSetting(row, $event.target.value)"
            />
          </span>
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
  { key: 'key', title: '配置项', width: '240px' },
  { key: 'description', title: '说明' },
  { key: 'value', title: '值', width: '200px', align: 'center' }
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
    settings.value = rows.map(row => {
      const meta = knownSettings[row.key] || { type: 'text', description: row.description || '' }
      return { ...row, ...meta }
    })
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
@use '@/styles/common.scss';
</style>
