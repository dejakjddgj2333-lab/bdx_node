<template>
  <div class="kb-detail-page fade-in">
    <div class="page-header">
      <div class="title-group">
        <button class="back-btn" @click="$router.back()">← 返回</button>
        <h1 class="page-title">{{ kbName }}</h1>
      </div>
      <div class="toolbar">
        <input ref="fileInput" type="file" hidden @change="handleFileChange" />
        <GlowButton :loading="uploading" @click="$refs.fileInput.click()">上传文档</GlowButton>
      </div>
    </div>

    <GlassCard>
      <DataTable :columns="columns" :data="documents" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'file_size'">{{ formatSize(row.file_size) }}</span>
          <span v-else-if="column.key === 'parse_status'">
            <span :class="['badge', statusClass(row.parse_status)]">{{ statusText(row.parse_status) }}</span>
          </span>
          <span v-else-if="column.key === 'is_public'">
            <label class="switch">
              <input
                type="checkbox"
                :checked="row.is_public"
                @change="togglePublic(row, $event.target.checked)"
              />
              <span class="switch__slider" />
            </label>
          </span>
          <span v-else-if="column.key === 'created_at'">{{ formatDate(row.created_at) }}</span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="handleReparse(row)">重新解析</button>
            <button class="action-btn action-btn--danger" @click="handleDelete(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>

      <div v-if="pagination.totalPages > 1" class="pagination">
        <button
          :disabled="pagination.page === 1"
          class="page-btn"
          @click="changePage(pagination.page - 1)"
        >上一页</button>
        <span class="page-info">第 {{ pagination.page }} / {{ pagination.totalPages }} 页</span>
        <button
          :disabled="pagination.page === pagination.totalPages"
          class="page-btn"
          @click="changePage(pagination.page + 1)"
        >下一页</button>
      </div>
    </GlassCard>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import DataTable from '@/components/DataTable.vue'
import GlowButton from '@/components/GlowButton.vue'

const route = useRoute()
const router = useRouter()
const kbId = computed(() => route.params.id)
const kbName = ref('知识库详情')

const columns = [
  { key: 'id', title: 'ID', width: '70px' },
  { key: 'original_name', title: '文件名' },
  { key: 'file_type', title: '类型', width: '120px' },
  { key: 'file_size', title: '大小', width: '100px' },
  { key: 'parse_status', title: '解析状态', width: '110px', align: 'center' },
  { key: 'is_public', title: '公开', width: '80px', align: 'center' },
  { key: 'created_at', title: '上传时间', width: '160px' },
  { key: 'actions', title: '操作', width: '160px', align: 'center' }
]

const documents = ref([])
const loading = ref(false)
const uploading = ref(false)
const fileInput = ref(null)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
})

function formatSize(bytes) {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusText(status) {
  const map = {
    pending: '待解析',
    parsing: '解析中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

function statusClass(status) {
  if (status === 'completed') return 'badge--success'
  if (status === 'failed') return 'badge--danger'
  if (status === 'parsing') return 'badge--warning'
  return 'badge--default'
}

async function loadKbName() {
  try {
    const res = await adminApi.getKnowledgeBases({ pageSize: 100 })
    const kb = res.list.find(item => String(item.id) === String(kbId.value))
    if (kb) kbName.value = kb.name
  } catch (e) {
    console.error(e)
  }
}

async function loadDocuments() {
  loading.value = true
  try {
    const res = await adminApi.getDocuments(kbId.value, {
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    documents.value = res.list
    pagination.total = res.pagination.total
    pagination.totalPages = res.pagination.totalPages
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function changePage(page) {
  pagination.page = page
  loadDocuments()
}

async function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    await adminApi.uploadDocument(kbId.value, file)
    loadDocuments()
  } catch (err) {
    alert(err.message)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function handleDelete(row) {
  if (!confirm(`确定删除文档「${row.original_name}」吗？`)) return
  try {
    await adminApi.deleteDocument(row.id)
    loadDocuments()
  } catch (e) {
    alert(e.message)
  }
}

async function handleReparse(row) {
  try {
    await adminApi.reparseDocument(row.id)
    alert('已重新加入解析队列')
    loadDocuments()
  } catch (e) {
    alert(e.message)
  }
}

async function togglePublic(row, val) {
  try {
    await adminApi.updateDocument(row.id, { is_public: val })
    row.is_public = val
  } catch (e) {
    alert(e.message)
  }
}

onMounted(() => {
  loadKbName()
  loadDocuments()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: $bg-elevated;
  border: 1px solid $border;
  color: $text-secondary;
  padding: 6px 14px;
  border-radius: $radius-sm;
  cursor: pointer;

  &:hover {
    background: $bg-hover;
    color: $primary;
    border-color: $primary;
  }
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

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid $border-subtle;
}

.page-btn {
  background: $bg-elevated;
  border: 1px solid $border;
  color: $text;
  padding: 6px 14px;
  border-radius: $radius-sm;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: $bg-hover;
    border-color: $primary;
    color: $primary;
  }
}

.page-info {
  font-size: 13px;
  color: $text-secondary;
}

.switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 22px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  &__slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: $border;
    border-radius: 22px;
    transition: 0.2s;

    &::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: 0.2s;
    }
  }

  input:checked + &__slider {
    background: $primary;
  }

  input:checked + &__slider::before {
    transform: translateX(20px);
  }
}
</style>
