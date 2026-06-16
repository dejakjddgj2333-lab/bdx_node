<template>
  <div class="user-manage-page fade-in">
    <div class="page-header">
      <h1 class="page-title">用户管理</h1>
      <div class="toolbar">
        <select v-model="filterStatus" @change="handleSearch">
          <option value="">全部状态</option>
          <option value="1">正常</option>
          <option value="0">禁用</option>
        </select>
        <input
          v-model="search"
          placeholder="搜索用户名/昵称/手机号/邮箱"
          style="width: 260px"
          @keyup.enter="handleSearch"
        />
        <GlowButton size="sm" @click="handleSearch">搜索</GlowButton>
      </div>
    </div>

    <GlassCard>
      <DataTable :columns="columns" :data="users" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'status'">
            <span :class="['badge', row.status === 1 ? 'badge--success' : 'badge--danger']">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </span>
          </span>
          <span v-else-if="column.key === 'created_at'">{{ formatDate(row.created_at) }}</span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="openEdit(row)">编辑</button>
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

    <Modal v-model:visible="editVisible" title="编辑用户">
      <div v-if="editForm" class="edit-form">
        <div class="form-group">
          <label>昵称</label>
          <input v-model="editForm.nickname" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="editForm.status">
            <option :value="1">正常</option>
            <option :value="0">禁用</option>
          </select>
        </div>
        <div class="form-group">
          <label>VIP 等级</label>
          <input v-model.number="editForm.vip_level" type="number" />
        </div>
        <div class="form-group">
          <label>每日额度</label>
          <input v-model.number="editForm.daily_quota" type="number" />
        </div>
      </div>

      <template #footer>
        <GlowButton variant="secondary" @click="editVisible = false">取消</GlowButton>
        <GlowButton :loading="editLoading" @click="saveEdit">保存</GlowButton>
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
  { key: 'id', title: 'ID', width: '70px' },
  { key: 'username', title: '用户名' },
  { key: 'nickname', title: '昵称' },
  { key: 'vip_level', title: 'VIP', width: '70px', align: 'center' },
  { key: 'status', title: '状态', width: '90px', align: 'center' },
  { key: 'daily_quota', title: '日额度', width: '90px', align: 'center' },
  { key: 'used_quota', title: '已用', width: '90px', align: 'center' },
  { key: 'created_at', title: '注册时间', width: '160px' },
  { key: 'actions', title: '操作', width: '120px', align: 'center' }
]

const users = ref([])
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
})

const editVisible = ref(false)
const editLoading = ref(false)
const editForm = ref(null)

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await adminApi.getUsers({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: search.value,
      status: filterStatus.value
    })
    users.value = res.list
    pagination.total = res.pagination.total
    pagination.totalPages = res.pagination.totalPages
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadUsers()
}

function changePage(page) {
  pagination.page = page
  loadUsers()
}

function openEdit(row) {
  editForm.value = { ...row }
  editVisible.value = true
}

async function saveEdit() {
  editLoading.value = true
  try {
    await adminApi.updateUser(editForm.value.id, {
      nickname: editForm.value.nickname,
      status: editForm.value.status,
      vip_level: editForm.value.vip_level,
      daily_quota: editForm.value.daily_quota
    })
    editVisible.value = false
    loadUsers()
  } catch (e) {
    alert(e.message)
  } finally {
    editLoading.value = false
  }
}

async function handleDelete(row) {
  if (!confirm(`确定删除用户 ${row.username} 吗？`)) return
  try {
    await adminApi.deleteUser(row.id)
    loadUsers()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(loadUsers)
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

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
