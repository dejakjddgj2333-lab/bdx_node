<template>
  <div class="suggestion-page fade-in">
    <div class="page-header">
      <h1 class="page-title">推荐语配置</h1>
      <GlowButton @click="openCreate">+ 新建推荐语</GlowButton>
    </div>

    <GlassCard class="section">
      <DataTable :columns="columns" :data="list" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'is_active'">
            <span :class="['badge', row.is_active ? 'badge--success' : 'badge--default']">
              {{ row.is_active ? '启用' : '停用' }}
            </span>
          </span>
          <span v-else-if="column.key === 'prompt'" class="cell-ellipsis" :title="row.prompt">{{ row.prompt }}</span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="openEdit(row)">编辑</button>
            <button class="action-btn action-btn--danger" @click="handleDelete(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>

      <div v-if="!list.length && !loading" class="empty">暂无推荐语，点击右上角创建</div>
    </GlassCard>

    <Modal v-model:visible="modalVisible" :title="isEdit ? '编辑推荐语' : '新建推荐语'" width="560px">
      <div class="edit-form">
        <div class="form-group">
          <label>显示标题 *</label>
          <input v-model="form.title" placeholder="如：预测冠军队，抢万亿Token" />
        </div>
        <div class="form-group">
          <label>提示词内容 *</label>
          <textarea v-model="form.prompt" placeholder="点击该推荐语后发送给 AI 的完整内容" rows="4" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>排序</label>
            <input v-model.number="form.sort_order" type="number" />
          </div>
          <label class="checkbox">
            <input v-model="form.is_active" type="checkbox" />
            启用
          </label>
        </div>
      </div>

      <template #footer>
        <GlowButton variant="secondary" @click="modalVisible = false">取消</GlowButton>
        <GlowButton :loading="submitting" @click="handleSubmit">保存</GlowButton>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import DataTable from '@/components/DataTable.vue'
import GlowButton from '@/components/GlowButton.vue'
import Modal from '@/components/Modal.vue'

const columns = [
  { key: 'title', title: '显示标题' },
  { key: 'prompt', title: '提示词内容' },
  { key: 'sort_order', title: '排序', width: '80px', align: 'center' },
  { key: 'is_active', title: '状态', width: '80px', align: 'center' },
  { key: 'actions', title: '操作', width: '120px', align: 'center' }
]

const list = ref([])
const loading = ref(false)
const modalVisible = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const form = reactive({
  id: null,
  title: '',
  prompt: '',
  is_active: true,
  sort_order: 0
})

async function loadList() {
  loading.value = true
  try {
    list.value = await adminApi.getPromptSuggestions()
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEdit.value = false
  form.id = null
  form.title = ''
  form.prompt = ''
  form.is_active = true
  form.sort_order = 0
  modalVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  Object.assign(form, {
    ...row,
    is_active: !!row.is_active
  })
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.title.trim() || !form.prompt.trim()) {
    alert('请输入标题和提示词内容')
    return
  }

  submitting.value = true
  try {
    const payload = {
      title: form.title.trim(),
      prompt: form.prompt.trim(),
      is_active: form.is_active,
      sort_order: form.sort_order || 0
    }
    if (isEdit.value) {
      await adminApi.updatePromptSuggestion(form.id, payload)
    } else {
      await adminApi.createPromptSuggestion(payload)
    }
    modalVisible.value = false
    loadList()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  if (!confirm(`确定删除推荐语「${row.title}」吗？`)) return
  try {
    await adminApi.deletePromptSuggestion(row.id)
    loadList()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: $text;
  margin: 0;
}

.section {
  margin-bottom: 24px;
}

.empty {
  text-align: center;
  padding: 48px 0;
  color: $text-secondary;
  font-size: 14px;
}

.cell-ellipsis {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.edit-form {
  .form-group {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: $text-secondary;
    }

    input,
    textarea,
    select {
      width: 100%;
      padding: 10px 12px;
      background: $bg-elevated;
      border: 1px solid $border;
      border-radius: $radius-sm;
      color: $text;
      font-size: 14px;

      &:focus {
        outline: none;
        border-color: $primary;
      }
    }

    textarea {
      resize: vertical;
      min-height: 80px;
    }
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: end;
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: $text-secondary;
    font-size: 14px;
    margin-bottom: 16px;

    input {
      width: auto;
    }
  }
}
</style>
