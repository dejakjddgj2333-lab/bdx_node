<template>
  <div class="image-model-config-page fade-in">
    <div class="page-header">
      <h1 class="page-title">绘图模型配置</h1>
    </div>

    <GlassCard class="section">
      <template #header>绘图模型列表</template>
      <DataTable :columns="columns" :data="models" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'is_active'">
            <span :class="['badge', row.is_active ? 'badge--success' : 'badge--default']">{{ row.is_active ? '启用' : '停用' }}</span>
          </span>
          <span v-else-if="column.key === 'is_default'">
            <span v-if="row.is_default" class="badge badge--warning">默认</span>
            <button v-else class="action-btn" @click="updateModel(row, { is_default: true })">设为默认</button>
          </span>
          <span v-else-if="column.key === 'supported_sizes'">
            {{ formatJson(row.supported_sizes) }}
          </span>
          <span v-else-if="column.key === 'supported_styles'">
            {{ formatJson(row.supported_styles) }}
          </span>
          <span v-else-if="column.key === 'sort_order'">
            <input
              :value="row.sort_order"
              type="number"
              class="inline-input"
              @blur="updateModel(row, { sort_order: Number($event.target.value) })"
            />
          </span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="openEdit(row)">编辑</button>
            <button class="action-btn action-btn--danger" @click="handleDelete(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>

      <div class="table-footer">
        <GlowButton size="sm" @click="openCreate">+ 新增绘图模型</GlowButton>
      </div>
    </GlassCard>

    <Modal v-model:visible="modalVisible" :title="isEdit ? '编辑绘图模型' : '新增绘图模型'" width="600px">
      <div class="edit-form">
        <div class="form-group">
          <label>厂商 *</label>
          <select v-model="form.provider">
            <option value="">请选择</option>
            <option v-for="(preset, key) in providerPresets" :key="key" :value="key">{{ preset.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>模型 ID *</label>
          <input v-model="form.model_id" placeholder="火山方舟 Endpoint ID，如 ep-2024xxxxx-xxx" />
        </div>

        <div class="form-group">
          <label>显示名称 *</label>
          <input v-model="form.name" placeholder="如 豆包文生图" />
        </div>

        <div class="form-group">
          <label>描述</label>
          <textarea v-model="form.description" placeholder="模型简介" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>排序</label>
            <input v-model.number="form.sort_order" type="number" />
          </div>
          <div class="form-group form-group--inline">
            <label class="checkbox">
              <input v-model="form.is_active" type="checkbox" />
              启用
            </label>
            <label class="checkbox">
              <input v-model="form.is_default" type="checkbox" />
              设为默认
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>支持尺寸（JSON 数组）</label>
          <input v-model="form.supported_sizes" placeholder='["1024x1024", "1536x1024"]' />
        </div>

        <div class="form-group">
          <label>支持风格（JSON 数组）</label>
          <input v-model="form.supported_styles" placeholder='["通用", "写实", "动漫"]' />
        </div>

        <div class="form-group">
          <label>额外配置（JSON）</label>
          <textarea v-model="form.config" rows="3" placeholder='{"quality": "standard"}' />
        </div>
      </div>

      <template #footer>
        <GlowButton variant="secondary" @click="modalVisible = false">取消</GlowButton>
        <GlowButton :loading="submitting" @click="save">保存</GlowButton>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import DataTable from '@/components/DataTable.vue'
import GlowButton from '@/components/GlowButton.vue'
import Modal from '@/components/Modal.vue'

const columns = [
  { key: 'name', title: '模型名称' },
  { key: 'provider', title: '厂商', width: '100px', align: 'center' },
  { key: 'model_id', title: '模型 ID' },
  { key: 'is_active', title: '启用', width: '80px', align: 'center' },
  { key: 'is_default', title: '默认', width: '110px', align: 'center' },
  { key: 'supported_sizes', title: '支持尺寸' },
  { key: 'supported_styles', title: '支持风格' },
  { key: 'sort_order', title: '排序', width: '80px', align: 'center' },
  { key: 'actions', title: '操作', width: '120px', align: 'center' }
]

const providerPresets = ref({})
const models = ref([])
const loading = ref(false)
const modalVisible = ref(false)
const submitting = ref(false)
const isEdit = ref(false)

const form = reactive({
  id: null,
  name: '',
  provider: 'doubao',
  model_id: '',
  description: '',
  is_active: true,
  is_default: false,
  sort_order: 0,
  supported_sizes: '["1024x1024", "1536x1024", "1024x1536", "2048x2048"]',
  supported_styles: '["通用", "写实", "动漫", "油画"]',
  config: '{}'
})

async function loadProviderPresets() {
  try {
    providerPresets.value = await adminApi.getProviderPresets()
  } catch (e) {
    console.error('加载 Provider 预设失败:', e)
  }
}

async function loadModels() {
  loading.value = true
  try {
    models.value = await adminApi.getImageModels()
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function formatJson(value) {
  try {
    return JSON.parse(value || '[]').join(', ')
  } catch (e) {
    return value || '-'
  }
}

function openCreate() {
  isEdit.value = false
  Object.assign(form, {
    id: null,
    name: '',
    provider: 'doubao',
    model_id: '',
    description: '',
    is_active: true,
    is_default: false,
    sort_order: 0,
    supported_sizes: '["1024x1024", "1536x1024", "1024x1536", "2048x2048"]',
    supported_styles: '["通用", "写实", "动漫", "油画"]',
    config: '{}'
  })
  modalVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  Object.assign(form, {
    ...row,
    supported_sizes: JSON.stringify(JSON.parse(row.supported_sizes || '[]')),
    supported_styles: JSON.stringify(JSON.parse(row.supported_styles || '[]')),
    config: JSON.stringify(JSON.parse(row.config || '{}'))
  })
  modalVisible.value = true
}

async function updateModel(row, data) {
  try {
    await adminApi.updateImageModel(row.id, data)
    loadModels()
  } catch (e) {
    alert(e.message)
  }
}

async function handleDelete(row) {
  if (!confirm(`确定删除绘图模型「${row.name}」吗？`)) return
  try {
    await adminApi.deleteImageModel(row.id)
    loadModels()
  } catch (e) {
    alert(e.message)
  }
}

function parseJsonField(value, fieldName) {
  try {
    return JSON.parse(value || '[]')
  } catch (e) {
    throw new Error(`${fieldName} 必须是合法 JSON`)
  }
}

async function save() {
  if (!form.provider || !form.model_id || !form.name) {
    alert('请填写厂商、模型 ID 和显示名称')
    return
  }

  let supported_sizes, supported_styles, config
  try {
    supported_sizes = parseJsonField(form.supported_sizes, '支持尺寸')
    supported_styles = parseJsonField(form.supported_styles, '支持风格')
    config = parseJsonField(form.config, '额外配置')
  } catch (e) {
    alert(e.message)
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: form.name,
      provider: form.provider,
      model_id: form.model_id,
      description: form.description,
      is_active: form.is_active,
      is_default: form.is_default,
      sort_order: form.sort_order,
      supported_sizes,
      supported_styles,
      config
    }
    if (isEdit.value) {
      await adminApi.updateImageModel(form.id, payload)
    } else {
      await adminApi.createImageModel(payload)
    }
    modalVisible.value = false
    loadModels()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadProviderPresets()
  loadModels()
})
</script>

<style scoped lang="scss">
@use '@/styles/common.scss';
</style>
