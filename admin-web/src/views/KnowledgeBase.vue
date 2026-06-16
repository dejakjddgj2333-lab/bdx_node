<template>
  <div class="knowledge-page fade-in">
    <div class="page-header">
      <h1 class="page-title">知识库</h1>
      <GlowButton @click="openCreate">+ 新建知识库</GlowButton>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="kb-grid">
      <GlassCard
        v-for="kb in list"
        :key="kb.id"
        class="kb-card"
        @click="goDetail(kb.id)"
      >
        <div class="kb-card__header">
          <div class="kb-card__title">{{ kb.name }}</div>
          <span :class="['badge', kb.is_active ? 'badge--success' : 'badge--default']">
            {{ kb.is_active ? '启用' : '停用' }}
          </span>
        </div>
        <div class="kb-card__desc">{{ kb.description || '暂无描述' }}</div>
        <div class="kb-card__meta">
          <span>文档数：{{ kb.document_count || 0 }}</span>
          <span>{{ formatDate(kb.created_at) }}</span>
        </div>
        <div class="kb-card__actions" @click.stop
        >
          <button class="action-btn" @click="openEdit(kb)">编辑</button>
          <button class="action-btn action-btn--danger" @click="handleDelete(kb)">删除</button>
        </div>
      </GlassCard>

      <div v-if="!list.length" class="empty">暂无知识库，点击右上角创建</div>
    </div>

    <Modal v-model:visible="modalVisible" :title="isEdit ? '编辑知识库' : '新建知识库'">
      <div class="edit-form">
        <div class="form-group">
          <label>名称 *</label>
          <input v-model="form.name" placeholder="请输入知识库名称" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="form.description" placeholder="请输入描述" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="form.is_active">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
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
import { useRouter } from 'vue-router'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import GlowButton from '@/components/GlowButton.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const list = ref([])
const loading = ref(false)
const modalVisible = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const form = reactive({
  id: null,
  name: '',
  description: '',
  is_active: true
})

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadList() {
  loading.value = true
  try {
    const res = await adminApi.getKnowledgeBases({ pageSize: 100 })
    list.value = res.list
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function goDetail(id) {
  router.push({ name: 'KnowledgeBaseDetail', params: { id } })
}

function openCreate() {
  isEdit.value = false
  form.id = null
  form.name = ''
  form.description = ''
  form.is_active = true
  modalVisible.value = true
}

function openEdit(kb) {
  isEdit.value = true
  form.id = kb.id
  form.name = kb.name
  form.description = kb.description || ''
  form.is_active = !!kb.is_active
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.name.trim()) {
    alert('请输入名称')
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await adminApi.updateKnowledgeBase(form.id, form)
    } else {
      await adminApi.createKnowledgeBase(form)
    }
    modalVisible.value = false
    loadList()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(kb) {
  if (!confirm(`确定删除知识库「${kb.name}」吗？`)) return
  try {
    await adminApi.deleteKnowledgeBase(kb.id)
    loadList()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(loadList)
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.kb-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }

  :deep(.glass-card__body) {
    padding: 20px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: $text;
  }

  &__desc {
    font-size: 13px;
    color: $text-secondary;
    margin-bottom: 16px;
    min-height: 38px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: $text-tertiary;
    margin-bottom: 14px;
  }

  &__actions {
    display: flex;
    gap: 8px;
  }
}

.loading, .empty {
  text-align: center;
  color: $text-secondary;
  padding: 60px 0;
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
  }
}
</style>
