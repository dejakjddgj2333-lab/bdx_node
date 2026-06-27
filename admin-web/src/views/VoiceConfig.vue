<template>
  <div class="voice-config-page fade-in">
    <div class="page-header">
      <h1 class="page-title">语音音色管理</h1>
    </div>

    <GlassCard class="section">
      <template #header>
        TTS 音色库
        <span class="header-hint">方舟 doubao-seed-tts-2.0，共 {{ voices.length }} 个音色</span>
      </template>

      <div class="toolbar">
        <GlowButton size="sm" variant="secondary" :loading="syncing" @click="handleSync">从方舟同步音色</GlowButton>
      </div>

      <DataTable :columns="columns" :data="voices" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'avatar'" class="avatar-cell">
            <img v-if="row.avatar" :src="row.avatar" class="avatar" :alt="row.name" />
            <span v-else class="avatar avatar--empty">{{ row.emoji || '🎙' }}</span>
          </span>
          <span v-else-if="column.key === 'name'" class="name-cell">
            <span class="name">{{ row.name }}</span>
            <span v-if="row.emoji" class="emoji">{{ row.emoji }}</span>
          </span>
          <span v-else-if="column.key === 'gender'" class="badge" :class="row.gender === '男' ? 'badge--male' : 'badge--female'">{{ row.gender }}</span>
          <span v-else-if="column.key === 'description'" class="desc">{{ row.description }}</span>
          <span v-else-if="column.key === 'trial'" class="trial-cell">
            <button v-if="row.trial_url" class="action-btn" @click="playTrial(row)">试听</button>
            <span v-else class="muted">—</span>
          </span>
          <span v-else-if="column.key === 'is_exposed'">
            <label class="switch">
              <input type="checkbox" :checked="row.is_exposed" @change="updateVoice(row, { is_exposed: $event.target.checked })" />
              <span class="switch__slider" />
            </label>
          </span>
          <span v-else-if="column.key === 'is_default'">
            <span v-if="row.is_default" class="badge badge--warning">默认</span>
            <button v-else class="action-btn" @click="setDefault(row)">设为默认</button>
          </span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="openEdit(row)">编辑</button>
            <button class="action-btn action-btn--danger" @click="handleDelete(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>
    </GlassCard>

    <!-- 试听播放器 -->
    <audio v-if="trialUrl" ref="audioRef" :src="trialUrl" autoplay @ended="trialUrl = ''" />

    <!-- 编辑弹窗 -->
    <Modal v-model:visible="modalVisible" title="编辑音色" width="520px">
      <div class="edit-form">
        <div class="form-group">
          <label>中文名</label>
          <input v-model="form.name" />
        </div>
        <div class="form-group">
          <label>speaker ID（方舟 VoiceType）</label>
          <input v-model="form.speaker" disabled />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>性别</label>
            <input v-model="form.gender" />
          </div>
          <div class="form-group">
            <label>年龄</label>
            <input v-model="form.age" />
          </div>
        </div>
        <div class="form-group">
          <label>介绍</label>
          <textarea v-model="form.description" rows="3" />
        </div>
        <div class="form-group">
          <label>头像 URL</label>
          <input v-model="form.avatar" />
        </div>
        <div class="form-group">
          <label>试听 URL</label>
          <input v-model="form.trial_url" />
        </div>
        <div class="form-group form-group--inline">
          <label class="checkbox"><input v-model="form.is_exposed" type="checkbox" /> 暴露给 App</label>
          <label class="checkbox"><input v-model="form.is_default" type="checkbox" /> 设为默认</label>
        </div>
      </div>
      <template #footer>
        <GlowButton variant="secondary" @click="modalVisible = false">取消</GlowButton>
        <GlowButton :loading="submitting" @click="saveVoice">保存</GlowButton>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, nextTick } from 'vue'
import adminApi from '@/api/admin'
import GlassCard from '@/components/GlassCard.vue'
import DataTable from '@/components/DataTable.vue'
import GlowButton from '@/components/GlowButton.vue'
import Modal from '@/components/Modal.vue'

const columns = [
  { key: 'avatar', title: '头像', width: '64px', align: 'center' },
  { key: 'name', title: '名称', width: '140px' },
  { key: 'gender', title: '性别', width: '70px', align: 'center' },
  { key: 'age', title: '年龄', width: '70px', align: 'center' },
  { key: 'description', title: '介绍' },
  { key: 'trial', title: '试听', width: '80px', align: 'center' },
  { key: 'is_exposed', title: 'App 可选', width: '90px', align: 'center' },
  { key: 'is_default', title: '默认', width: '110px', align: 'center' },
  { key: 'actions', title: '操作', width: '140px', align: 'center' }
]

const voices = ref([])
const loading = ref(false)
const syncing = ref(false)
const trialUrl = ref('')
const audioRef = ref(null)

const modalVisible = ref(false)
const submitting = ref(false)
const form = reactive({
  id: null, name: '', speaker: '', gender: '', age: '', description: '',
  avatar: '', trial_url: '', is_exposed: false, is_default: false
})

async function loadVoices() {
  loading.value = true
  try {
    voices.value = await adminApi.getTtsVoices()
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

function playTrial(row) {
  trialUrl.value = row.trial_url
  nextTick(() => audioRef.value && audioRef.value.play().catch(() => {}))
}

async function updateVoice(row, data) {
  try {
    await adminApi.updateTtsVoice(row.id, data)
    loadVoices()
  } catch (e) {
    alert(e.message)
  }
}

async function setDefault(row) {
  try {
    await adminApi.setDefaultTtsVoice(row.id)
    loadVoices()
  } catch (e) {
    alert(e.message)
  }
}

async function handleDelete(row) {
  if (!confirm(`确定删除音色「${row.name}」吗？`)) return
  try {
    await adminApi.deleteTtsVoice(row.id)
    loadVoices()
  } catch (e) {
    alert(e.message)
  }
}

async function handleSync() {
  syncing.value = true
  try {
    const res = await adminApi.syncTtsVoices()
    alert(`同步完成，共 ${res.count} 个音色`)
    loadVoices()
  } catch (e) {
    alert('同步失败：' + e.message)
  } finally {
    syncing.value = false
  }
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id, name: row.name, speaker: row.speaker, gender: row.gender || '',
    age: row.age || '', description: row.description || '', avatar: row.avatar || '',
    trial_url: row.trial_url || '', is_exposed: !!row.is_exposed, is_default: !!row.is_default
  })
  modalVisible.value = true
}

async function saveVoice() {
  submitting.value = true
  try {
    await adminApi.updateTtsVoice(form.id, {
      name: form.name, gender: form.gender, age: form.age, description: form.description,
      avatar: form.avatar, trial_url: form.trial_url,
      is_exposed: form.is_exposed, is_default: form.is_default
    })
    modalVisible.value = false
    loadVoices()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadVoices()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.voice-config-page { padding-bottom: 32px; }
.page-header { margin-bottom: 24px; .page-title { font-size: 24px; font-weight: 600; color: $text; margin: 0; letter-spacing: -0.02em; } }
.header-hint { font-size: 13px; color: $text-tertiary; font-weight: 400; margin-left: 12px; }
.section { margin-bottom: 24px; }
.toolbar { margin-bottom: 16px; }

.avatar {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: inline-block;
  &--empty { background: $bg-hover; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; }
}
.name-cell { display: inline-flex; align-items: center; gap: 6px; .name { font-weight: 500; } .emoji { font-size: 14px; } }
.desc { color: $text-secondary; font-size: 13px; }
.muted { color: $text-tertiary; }
.trial-cell, .actions { display: flex; gap: 6px; justify-content: center; }

.badge {
  display: inline-flex; align-items: center; padding: 2px 10px; border-radius: $radius-pill; font-size: 12px; font-weight: 500;
  &--male { background: rgba(#3b82f6, 0.12); color: #3b82f6; }
  &--female { background: rgba(#ec4899, 0.12); color: #ec4899; }
  &--warning { background: rgba($accent, 0.12); color: darken($accent, 8%); }
}

.action-btn {
  white-space: nowrap; background: rgba($primary, 0.08); border: 1px solid rgba($primary, 0.2);
  color: $primary; padding: 4px 10px; border-radius: $radius-sm; cursor: pointer; font-size: 12px;
  &:hover { background: rgba($primary, 0.15); }
  &--danger { background: rgba($pink, 0.08); border-color: rgba($pink, 0.2); color: $pink; &:hover { background: rgba($pink, 0.15); } }
}

.edit-form { display: flex; flex-direction: column; gap: 16px; .form-group { display: flex; flex-direction: column; gap: 6px; label { font-size: 13px; font-weight: 500; color: $text; } input, textarea { padding: 10px 12px; border: 1px solid $border; border-radius: $radius-md; font-size: 14px; color: $text; background: $bg-card; &:focus { outline: none; border-color: $primary; box-shadow: 0 0 0 3px $border-focus; } } textarea { resize: vertical; min-height: 60px; } } .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .form-group--inline { flex-direction: row; gap: 20px; .checkbox { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: $text; cursor: pointer; input { width: auto; } } } }

.switch { position: relative; display: inline-block; width: 42px; height: 22px; input { opacity: 0; width: 0; height: 0; } &__slider { position: absolute; cursor: pointer; inset: 0; background: $border; border-radius: 22px; transition: 0.2s; &::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; } } input:checked + &__slider { background: $primary; } input:checked + &__slider::before { transform: translateX(20px); } }
</style>
