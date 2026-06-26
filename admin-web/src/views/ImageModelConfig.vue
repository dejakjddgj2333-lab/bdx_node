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
          <span v-else-if="column.key === 'supported_sizes'" class="cell-tags">
            <span v-for="(tag, idx) in formatJsonList(row.supported_sizes)" :key="idx" class="tag">{{ tag }}</span>
          </span>
          <span v-else-if="column.key === 'supported_styles'" class="cell-tags">
            <span v-for="(tag, idx) in formatJsonList(row.supported_styles)" :key="idx" class="tag">{{ tag }}</span>
          </span>
          <span v-else-if="column.key === 'model_id'" :title="row.model_id" class="model-id-cell">{{ row.model_id }}</span>
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
          <select v-model="form.provider" disabled>
            <option value="ark">火山方舟</option>
          </select>
          <span class="form-hint">图像生成已收敛到火山方舟 Agent Plan，厂商固定为 ark</span>
        </div>

        <div class="form-group">
          <label>模型 ID *</label>
          <input v-model="form.model_id" placeholder="方舟模型 ID，如 doubao-seedream-5.0-lite" />
          <span class="form-hint">方舟 Plan /images/generations 调用时使用的 model 字段</span>
        </div>

        <div class="form-group">
          <label>显示名称 *</label>
          <input v-model="form.name" placeholder="如 豆包文生图" />
        </div>

        <div class="form-group">
          <label>描述</label>
          <textarea v-model="form.description" placeholder="模型简介，会在前端选择模型时显示" />
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
          <input v-model="form.supported_sizes" placeholder='["1K", "2K"]' />
          <span class="form-hint">方舟 Plan 出图档位，如 1K / 2K（单边不超 2048）</span>
        </div>

        <div class="form-group">
          <label>支持风格（JSON 数组）</label>
          <input v-model="form.supported_styles" placeholder='["通用", "写实", "动漫"]' />
          <span class="form-hint">留空表示该模型不支持风格选择</span>
        </div>

        <div class="form-group">
          <label>额外配置（JSON）</label>
          <textarea v-model="form.config" rows="3" placeholder='{}' />
          <span class="form-hint">方舟 Plan 出图参数固定（output_format=png/response_format=url/watermark=false），此字段当前不透传</span>
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
  provider: 'ark',
  model_id: '',
  description: '',
  is_active: true,
  is_default: false,
  sort_order: 0,
  supported_sizes: '["1K", "2K"]',
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

function formatJsonList(value) {
  if (Array.isArray(value)) return value
  try {
    return JSON.parse(value || '[]')
  } catch (e) {
    return []
  }
}

function formatJson(value) {
  if (Array.isArray(value)) return value.join(', ')
  try {
    return JSON.parse(value || '[]').join(', ')
  } catch (e) {
    return value || '-'
  }
}

function stringifyJsonField(value, defaultValue = '[]') {
  if (value == null) return defaultValue
  if (typeof value !== 'string') return JSON.stringify(value)
  try {
    return JSON.stringify(JSON.parse(value || defaultValue))
  } catch (e) {
    return defaultValue
  }
}

function openCreate() {
  isEdit.value = false
  Object.assign(form, {
    id: null,
    name: '',
    provider: 'ark',
    model_id: '',
    description: '',
    is_active: true,
    is_default: false,
    sort_order: 0,
    supported_sizes: '["1K", "2K"]',
    supported_styles: '["通用", "写实", "动漫", "油画"]',
    config: '{}'
  })
  modalVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  Object.assign(form, {
    ...row,
    supported_sizes: stringifyJsonField(row.supported_sizes, '[]'),
    supported_styles: stringifyJsonField(row.supported_styles, '[]'),
    config: stringifyJsonField(row.config, '{}')
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
@use '@/styles/variables.scss' as *;

.image-model-config-page {
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

.table-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-btn {
  white-space: nowrap;
  flex-shrink: 0;
  background: rgba($primary, 0.08);
  border: 1px solid rgba($primary, 0.2);
  color: $primary;
  padding: 4px 10px;
  border-radius: $radius-sm;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba($primary, 0.15);
  }

  &--danger {
    background: rgba($pink, 0.08);
    border-color: rgba($pink, 0.2);
    color: $pink;

    &:hover {
      background: rgba($pink, 0.15);
    }
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: $radius-pill;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;

  &--success {
    background: rgba($success, 0.1);
    color: $success;
  }

  &--default {
    background: rgba($text-tertiary, 0.1);
    color: $text-secondary;
  }

  &--warning {
    background: rgba($accent, 0.1);
    color: darken($accent, 8%);
  }
}

.inline-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  font-size: 13px;
  color: $text;
  background: $bg-card;
  text-align: center;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $border-focus;
  }
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: rgba($primary, 0.08);
    border: 1px solid rgba($primary, 0.15);
    color: $primary;
    border-radius: $radius-pill;
    font-size: 11px;
    font-weight: 500;
  }
}

.model-id-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: $text-secondary;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px;
  align-items: flex-start;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    font-weight: 500;
    color: $text;
  }

  input,
  select,
  textarea {
    padding: 10px 12px;
    border: 1px solid $border;
    border-radius: $radius-md;
    font-size: 14px;
    color: $text;
    background: $bg-card;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:focus {
      outline: none;
      border-color: $primary;
      box-shadow: 0 0 0 3px $border-focus;
    }

    &::placeholder {
      color: $text-tertiary;
    }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
}

.form-group--inline {
  flex-direction: row;
  gap: 20px;
  align-items: center;
  padding-top: 24px;

  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: $text;
    cursor: pointer;
    user-select: none;

    input[type='checkbox'] {
      width: 16px;
      height: 16px;
      accent-color: $primary;
      cursor: pointer;
    }
  }
}

.form-hint {
  font-size: 12px;
  color: $text-tertiary;
  margin-top: 2px;
}

:deep(.modal-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
