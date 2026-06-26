<template>
  <div class="kb-detail-page fade-in">
    <div class="page-header">
      <div class="title-group">
        <button class="back-btn" @click="$router.back()">← 返回</button>
        <h1 class="page-title">{{ kbName }}</h1>
      </div>
      <div class="toolbar">
        <GlowButton variant="secondary" @click="openSearch">检索测试</GlowButton>
        <input ref="fileInput" type="file" hidden @change="handleFileChange" />
        <GlowButton :loading="uploading" @click="$refs.fileInput.click()">上传文档</GlowButton>
      </div>
    </div>

    <p class="hint">支持 txt / md / PDF / Word(.docx)。上传后自动解析、切块并生成向量。</p>

    <GlassCard>
      <DataTable :columns="columns" :data="documents" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'file_size'">{{ formatSize(row.file_size) }}</span>
          <span v-else-if="column.key === 'chunk_count'">{{ row.chunk_count || 0 }}</span>
          <span v-else-if="column.key === 'parse_status'">
            <span :class="['badge', statusClass(row.parse_status)]" :title="row.parse_error || ''">
              {{ statusText(row.parse_status) }}
            </span>
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
            <button
              class="action-btn"
              :disabled="!row.chunk_count"
              @click="openChunks(row)"
            >分块</button>
            <button class="action-btn" @click="handleReparse(row)">重新解析</button>
            <button class="action-btn" @click="handleRebuildEmbedding(row)">重算向量</button>
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

    <!-- 分块查看弹窗 -->
    <Modal v-model:visible="chunkModal.visible" :title="`分块详情 - ${chunkModal.name}`" width="760px">
      <div v-if="chunkModal.loading" class="modal-loading">加载中...</div>
      <div v-else-if="chunkModal.list.length === 0" class="modal-empty">暂无分块</div>
      <div v-else class="chunk-list">
        <div v-for="c in chunkModal.list" :key="c.id" class="chunk-item">
          <div class="chunk-item__head">
            <span class="chunk-item__idx">#{{ c.chunk_index }}</span>
            <span class="chunk-item__meta">{{ c.token_count }} 字 · {{ c.embedding_dim }} 维</span>
          </div>
          <div class="chunk-item__content">{{ c.content }}</div>
        </div>
      </div>
      <template #footer>
        <span class="footer-info">共 {{ chunkModal.total }} 块</span>
        <GlowButton variant="secondary" @click="chunkModal.visible = false">关闭</GlowButton>
      </template>
    </Modal>

    <!-- 检索测试弹窗 -->
    <Modal v-model:visible="searchModal.visible" title="知识库检索测试" width="720px">
      <div class="search-form">
        <textarea
          v-model="searchModal.query"
          class="search-input"
          rows="3"
          placeholder="输入一个问题，测试能否从知识库检索到相关分块..."
        />
        <div class="search-params">
          <label>TopK
            <input v-model.number="searchModal.topK" type="number" min="1" max="20" class="num-input" />
          </label>
          <label>最低分
            <input v-model.number="searchModal.minScore" type="number" min="0" max="1" step="0.05" class="num-input" />
          </label>
          <GlowButton :loading="searchModal.loading" @click="runSearch">检索</GlowButton>
        </div>
      </div>

      <div v-if="searchModal.searched" class="search-results">
        <div v-if="searchModal.results.length === 0" class="modal-empty">未检索到相关内容</div>
        <div v-for="(r, i) in searchModal.results" :key="r.id" class="result-item">
          <div class="result-item__head">
            <span class="result-rank">Top {{ i + 1 }}</span>
            <span class="result-score">相似度 {{ r.score.toFixed(4) }}</span>
            <span class="result-doc">{{ r.document_name }} #{{ r.chunk_index }}</span>
          </div>
          <div class="result-item__content">{{ r.content }}</div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import DataTable from '@/components/DataTable.vue'
import GlowButton from '@/components/GlowButton.vue'
import Modal from '@/components/Modal.vue'

const route = useRoute()
const kbId = computed(() => route.params.id)
const kbName = ref('知识库详情')

const columns = [
  { key: 'id', title: 'ID', width: '70px' },
  { key: 'original_name', title: '文件名' },
  { key: 'file_type', title: '类型', width: '110px' },
  { key: 'file_size', title: '大小', width: '90px' },
  { key: 'chunk_count', title: '分块', width: '70px', align: 'center' },
  { key: 'parse_status', title: '解析状态', width: '100px', align: 'center' },
  { key: 'is_public', title: '公开', width: '70px', align: 'center' },
  { key: 'created_at', title: '上传时间', width: '150px' },
  { key: 'actions', title: '操作', width: '280px', align: 'center' }
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

const chunkModal = reactive({
  visible: false,
  loading: false,
  name: '',
  list: [],
  total: 0
})

const searchModal = reactive({
  visible: false,
  loading: false,
  searched: false,
  query: '',
  topK: 5,
  minScore: 0.2,
  results: []
})

let pollTimer = null

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
    schedulePoll()
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

// 若有文档处于 pending/parsing，定时刷新状态
function schedulePoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  const hasPending = documents.value.some(d => ['pending', 'parsing'].includes(d.parse_status))
  if (hasPending) {
    pollTimer = setTimeout(() => loadDocuments(), 3000)
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
    loadDocuments()
  } catch (e) {
    alert(e.message)
  }
}

async function handleRebuildEmbedding(row) {
  if (!confirm(`确定使用当前向量模型重新生成「${row.original_name}」的向量吗？\n（不重新解析文本，仅重算 embedding）`)) return
  try {
    const res = await adminApi.rebuildEmbedding(row.id)
    alert(`重算完成，共 ${res.chunkCount} 块，模型 ${res.model}`)
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

async function openChunks(row) {
  chunkModal.visible = true
  chunkModal.loading = true
  chunkModal.name = row.original_name
  chunkModal.list = []
  try {
    const res = await adminApi.getDocumentChunks(row.id, { pageSize: 100 })
    chunkModal.list = res.list
    chunkModal.total = res.pagination.total
  } catch (e) {
    alert(e.message)
  } finally {
    chunkModal.loading = false
  }
}

function openSearch() {
  searchModal.visible = true
  searchModal.searched = false
  searchModal.results = []
}

async function runSearch() {
  if (!searchModal.query.trim()) {
    alert('请输入查询内容')
    return
  }
  searchModal.loading = true
  try {
    const res = await adminApi.searchKnowledgeBase(kbId.value, {
      query: searchModal.query.trim(),
      topK: searchModal.topK,
      minScore: searchModal.minScore
    })
    searchModal.results = res.results || []
    searchModal.searched = true
  } catch (e) {
    alert(e.message)
  } finally {
    searchModal.loading = false
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

.toolbar {
  display: flex;
  gap: 12px;
}

.hint {
  margin: 8px 0 16px;
  font-size: 13px;
  color: $text-tertiary;
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

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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

.modal-loading,
.modal-empty {
  text-align: center;
  color: $text-tertiary;
  padding: 32px 0;
  font-size: 14px;
}

.chunk-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 56vh;
  overflow-y: auto;
}

.chunk-item {
  border: 1px solid $border-subtle;
  border-radius: $radius-md;
  padding: 12px 14px;
  background: $bg-elevated;

  &__head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__idx {
    font-weight: 600;
    color: $primary;
    font-size: 13px;
  }

  &__meta {
    font-size: 12px;
    color: $text-tertiary;
  }

  &__content {
    font-size: 13px;
    color: $text-secondary;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.footer-info {
  margin-right: auto;
  font-size: 13px;
  color: $text-tertiary;
}

.search-form {
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  border: 1px solid $border;
  border-radius: $radius-md;
  padding: 10px 12px;
  font-size: 14px;
  color: $text;
  background: $bg-elevated;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: $primary;
  }
}

.search-params {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;

  label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: $text-secondary;
  }
}

.num-input {
  width: 64px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  padding: 4px 8px;
  font-size: 13px;
  color: $text;
  background: $bg-elevated;

  &:focus {
    outline: none;
    border-color: $primary;
  }
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 50vh;
  overflow-y: auto;
  border-top: 1px solid $border-subtle;
  padding-top: 16px;
}

.result-item {
  border: 1px solid $border-subtle;
  border-radius: $radius-md;
  padding: 12px 14px;
  background: $bg-elevated;

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  &__content {
    font-size: 13px;
    color: $text-secondary;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.result-rank {
  font-weight: 600;
  color: $primary;
  font-size: 13px;
}

.result-score {
  font-size: 12px;
  color: $success;
}

.result-doc {
  font-size: 12px;
  color: $text-tertiary;
}
</style>
