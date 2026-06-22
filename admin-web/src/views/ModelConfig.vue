<template>
  <div class="model-config-page fade-in">
    <div class="page-header">
      <h1 class="page-title">模型配置</h1>
    </div>

    <GlassCard class="section">
      <template #header>API Key 配置</template>
      <DataTable :columns="providerColumns" :data="providers" :loading="loading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'api_key'">
            {{ row.hasKey ? row.apiKey : '未配置' }}
          </span>
          <span v-else-if="column.key === 'is_active'">
            <span :class="['badge', row.is_active ? 'badge--success' : 'badge--default']">{{ row.is_active ? '启用' : '停用' }}</span>
          </span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="handleTestProvider(row)">测试</button>
            <button class="action-btn" @click="openProviderEdit(row)">配置</button>
            <button class="action-btn action-btn--danger" @click="handleDeleteProvider(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>

      <div class="table-footer">
        <GlowButton size="sm" @click="openProviderCreate">+ 新增 Provider</GlowButton>
      </div>
    </GlassCard>

    <GlassCard class="section">
      <template #header>语音通话厂商配置</template>
      <DataTable :columns="voiceProviderColumns" :data="voiceProviders" :loading="voiceProviderLoading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'api_key'">
            {{ row.hasKey ? row.apiKey : '未配置' }}
          </span>
          <span v-else-if="column.key === 'is_active'">
            <span :class="['badge', row.is_active ? 'badge--success' : 'badge--default']">{{ row.is_active ? '启用' : '停用' }}</span>
          </span>
          <span v-else-if="column.key === 'is_current'">
            <span v-if="row.is_current" class="badge badge--warning">当前使用</span>
            <button v-else class="action-btn" @click="handleSetCurrentVoiceProvider(row)">设为当前</button>
          </span>
          <span v-else-if="column.key === 'default_voice'">
            <select
              :value="row.default_voice"
              class="inline-select"
              @change="updateVoiceProvider(row, { default_voice: $event.target.value })"
            >
              <option v-for="v in row.voices" :key="v" :value="v" :title="row.voice_intros?.[v]">{{ row.voice_labels?.[v] || v }}</option>
            </select>
          </span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="handleTestVoiceProvider(row)">测试</button>
            <button class="action-btn" @click="openVoiceProviderEdit(row)">配置</button>
            <button class="action-btn action-btn--danger" @click="handleDeleteVoiceProvider(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>

      <div class="table-footer">
        <GlowButton size="sm" @click="openVoiceProviderCreate">+ 新增语音厂商</GlowButton>
      </div>
    </GlassCard>

    <GlassCard class="section">
      <template #header>模型列表</template>
      <DataTable :columns="modelColumns" :data="models" :loading="modelLoading">
        <template #cell="{ column, row }">
          <span v-if="column.key === 'is_active'">
            <label class="switch">
              <input
                type="checkbox"
                :checked="row.is_active"
                @change="updateModel(row, { is_active: $event.target.checked })"
              />
              <span class="switch__slider" />
            </label>
          </span>
          <span v-else-if="column.key === 'is_default'">
            <span v-if="row.is_default" class="badge badge--warning">默认</span>
            <button v-else class="action-btn" @click="updateModel(row, { is_default: true })">设为默认</button>
          </span>
          <span v-else-if="column.key === 'supports_vision'">
            <span :class="['badge', row.supports_vision ? 'badge--success' : 'badge--default']">{{ row.supports_vision ? '支持' : '不支持' }}</span>
          </span>
          <span v-else-if="column.key === 'supports_web_search'">
            <span :class="['badge', row.supports_web_search ? 'badge--success' : 'badge--default']">{{ row.supports_web_search ? '支持' : '不支持' }}</span>
          </span>
          <span v-else-if="column.key === 'max_tokens'">
            <input
              :value="row.max_tokens"
              type="number"
              class="inline-input"
              @blur="updateModel(row, { max_tokens: Number($event.target.value) })"
            />
          </span>
          <span v-else-if="column.key === 'sort_order'">
            <input
              :value="row.sort_order"
              type="number"
              class="inline-input"
              @blur="updateModel(row, { sort_order: Number($event.target.value) })"
            />
          </span>
          <span v-else-if="column.key === 'provider'">
            <span class="badge badge--default">{{ row.provider }}</span>
          </span>
          <span v-else-if="column.key === 'actions'" class="actions">
            <button class="action-btn" @click="openModelEdit(row)">编辑</button>
            <button class="action-btn action-btn--danger" @click="handleDeleteModel(row)">删除</button>
          </span>
          <span v-else>{{ row[column.key] }}</span>
        </template>
      </DataTable>

      <div class="table-footer">
        <GlowButton size="sm" @click="openModelCreate">+ 新增模型</GlowButton>
      </div>
    </GlassCard>

    <!-- Provider 弹窗 -->
    <Modal v-model:visible="providerModalVisible" :title="isProviderEdit ? (isPreset(providerForm.provider) ? '配置 API Key' : '编辑 Provider') : '新增 Provider'" width="520px">
      <div class="edit-form">
        <div v-if="!isProviderEdit" class="form-group">
          <label>选择厂商 *</label>
          <select v-model="providerForm.provider" @change="onPresetChange">
            <option value="">请选择</option>
            <option v-for="(preset, key) in providerPresets" :key="key" :value="key">{{ preset.name }}</option>
          </select>
        </div>

        <div v-else class="form-group">
          <label>厂商</label>
          <input :value="providerForm.name" disabled />
        </div>

        <div class="form-group">
          <label>API Key *</label>
          <input v-model="providerForm.api_key" type="password" :placeholder="isProviderEdit ? '留空表示不修改' : '输入 API Key'" />
        </div>

        <div class="form-group">
          <label>Base URL</label>
          <input :value="providerForm.base_url" disabled />
        </div>

        <div class="form-group">
          <label>状态</label>
          <select v-model="providerForm.is_active">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>

        <div class="form-group">
          <label>排序</label>
          <input v-model.number="providerForm.sort_order" type="number" />
        </div>
      </div>

      <template #footer>
        <GlowButton variant="secondary" @click="providerModalVisible = false">取消</GlowButton>
        <GlowButton :loading="providerSubmitting" @click="saveProvider">保存</GlowButton>
      </template>
    </Modal>

    <!-- 语音厂商弹窗 -->
    <Modal v-model:visible="voiceProviderModalVisible" :title="isVoiceProviderEdit ? '配置语音厂商' : '新增语音厂商'" width="520px">
      <div class="edit-form">
        <div v-if="!isVoiceProviderEdit" class="form-group">
          <label>选择厂商 *</label>
          <select v-model="voiceProviderForm.provider" @change="onVoiceProviderPresetChange">
            <option value="">请选择</option>
            <option v-for="(preset, key) in voiceProviderPresets" :key="key" :value="key">{{ preset.name }}</option>
          </select>
        </div>

        <div v-else class="form-group">
          <label>厂商</label>
          <input :value="voiceProviderForm.name" disabled />
        </div>

        <div class="form-group">
          <label>API Key *</label>
          <input v-model="voiceProviderForm.api_key" type="password" :placeholder="isVoiceProviderEdit ? '留空表示不修改' : '输入 API Key'" />
        </div>

        <div class="form-group">
          <label>Base URL</label>
          <input v-model="voiceProviderForm.base_url" />
        </div>

        <div class="form-group">
          <label>实时模型 ID</label>
          <input v-model="voiceProviderForm.realtime_model" :placeholder="voiceProviderForm._presetRealtimeModel || ''" />
        </div>

        <div class="form-group">
          <label>默认音色</label>
          <select v-model="voiceProviderForm.default_voice">
            <option v-for="v in voiceProviderForm._voices" :key="v" :value="v"
              :title="voiceProviderPresets[voiceProviderForm.provider]?.voice_intros?.[v]">
              {{ voiceProviderPresets[voiceProviderForm.provider]?.voice_labels?.[v] || v }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>状态</label>
          <select v-model="voiceProviderForm.is_active">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>

        <div class="form-group">
          <label>排序</label>
          <input v-model.number="voiceProviderForm.sort_order" type="number" />
        </div>
      </div>

      <template #footer>
        <GlowButton variant="secondary" @click="voiceProviderModalVisible = false">取消</GlowButton>
        <GlowButton :loading="voiceProviderSubmitting" @click="saveVoiceProvider">保存</GlowButton>
      </template>
    </Modal>

    <!-- 模型弹窗 -->
    <Modal v-model:visible="modelModalVisible" :title="isModelEdit ? '编辑模型' : '新增模型'" width="560px">
      <div class="edit-form">
        <div class="form-group">
          <label>厂商 *</label>
          <select v-model="modelForm.provider" :disabled="isModelEdit" @change="onModelProviderChange">
            <option value="">请选择</option>
            <option v-for="(preset, key) in providerPresets" :key="key" :value="key">{{ preset.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>模型 ID *</label>
          <div class="model-id-row">
            <input v-model="modelForm.model_id" placeholder="如 deepseek-v4-pro" />
            <GlowButton
              size="sm"
              variant="secondary"
              :loading="remoteModelsLoading"
              :disabled="!canFetchRemoteModels"
              @click="fetchRemoteModels"
            >
              拉取模型列表
            </GlowButton>
          </div>
          <select
            v-if="remoteModels.length"
            v-model="remoteModelPick"
            class="remote-model-select"
            @change="onRemoteModelPick"
          >
            <option value="">选择远程模型…</option>
            <option v-for="m in remoteModels" :key="m.id" :value="m">{{ m.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>显示名称 *</label>
          <input v-model="modelForm.name" placeholder="如 DeepSeek V4 Pro" />
        </div>

        <div class="form-group">
          <label>描述</label>
          <textarea v-model="modelForm.description" placeholder="模型简介" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Max Tokens</label>
            <input v-model.number="modelForm.max_tokens" type="number" />
          </div>
          <div class="form-group">
            <label>排序</label>
            <input v-model.number="modelForm.sort_order" type="number" />
          </div>
        </div>

        <div class="form-row">
          <label class="checkbox">
            <input v-model="modelForm.is_active" type="checkbox" />
            启用
          </label>
          <label class="checkbox">
            <input v-model="modelForm.is_default" type="checkbox" />
            设为默认
          </label>
          <label class="checkbox">
            <input v-model="modelForm.supports_vision" type="checkbox" />
            支持视觉
          </label>
          <label class="checkbox">
            <input v-model="modelForm.supports_web_search" type="checkbox" />
            支持联网
          </label>
        </div>
      </div>

      <template #footer>
        <GlowButton variant="secondary" @click="modelModalVisible = false">取消</GlowButton>
        <GlowButton :loading="modelSubmitting" @click="saveModel">保存</GlowButton>
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

const providerColumns = [
  { key: 'provider', title: '标识', width: '100px' },
  { key: 'name', title: '名称' },
  { key: 'api_key', title: 'API Key' },
  { key: 'is_active', title: '状态', width: '90px', align: 'center' },
  { key: 'actions', title: '操作', width: '160px', align: 'center' }
]

const modelColumns = [
  { key: 'name', title: '模型名称' },
  { key: 'provider', title: '厂商', width: '100px', align: 'center' },
  { key: 'model_id', title: '模型 ID' },
  { key: 'is_active', title: '启用', width: '80px', align: 'center' },
  { key: 'is_default', title: '默认', width: '110px', align: 'center' },
  { key: 'supports_vision', title: '视觉', width: '80px', align: 'center' },
  { key: 'supports_web_search', title: '联网', width: '80px', align: 'center' },
  { key: 'max_tokens', title: 'Max Tokens', width: '120px', align: 'center' },
  { key: 'sort_order', title: '排序', width: '80px', align: 'center' },
  { key: 'actions', title: '操作', width: '120px', align: 'center' }
]

const voiceProviderColumns = [
  { key: 'provider', title: '标识', width: '100px' },
  { key: 'name', title: '名称' },
  { key: 'api_key', title: 'API Key', width: '160px' },
  { key: 'realtime_model', title: '模型 ID' },
  { key: 'default_voice', title: '默认音色', width: '140px', align: 'center' },
  { key: 'is_active', title: '状态', width: '80px', align: 'center' },
  { key: 'is_current', title: '当前使用', width: '100px', align: 'center' },
  { key: 'actions', title: '操作', width: '180px', align: 'center' }
]

const providers = ref([])
const models = ref([])
const voiceProviders = ref([])
const loading = ref(false)
const modelLoading = ref(false)
const voiceProviderLoading = ref(false)
const providerPresets = ref({})
const voiceProviderPresets = ref({})

function isPreset(provider) {
  return !!providerPresets.value[provider]
}

async function loadProviderPresets() {
  try {
    providerPresets.value = await adminApi.getProviderPresets()
  } catch (e) {
    console.error('加载 Provider 预设失败:', e)
  }
}

async function loadProviders() {
  loading.value = true
  try {
    providers.value = await adminApi.getProviders()
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

async function loadModels() {
  modelLoading.value = true
  try {
    models.value = await adminApi.getModels()
  } catch (e) {
    alert(e.message)
  } finally {
    modelLoading.value = false
  }
}

async function loadVoiceProviderPresets() {
  try {
    voiceProviderPresets.value = await adminApi.getVoiceProviderPresets()
  } catch (e) {
    console.error('加载语音厂商预设失败:', e)
  }
}

async function loadVoiceProviders() {
  voiceProviderLoading.value = true
  try {
    voiceProviders.value = await adminApi.getVoiceProviders()
  } catch (e) {
    alert(e.message)
  } finally {
    voiceProviderLoading.value = false
  }
}

// Provider 弹窗
const providerModalVisible = ref(false)
const providerSubmitting = ref(false)
const isProviderEdit = ref(false)
const providerForm = reactive({
  id: null,
  provider: '',
  name: '',
  api_key: '',
  base_url: '',
  is_active: true,
  sort_order: 0
})

function onPresetChange() {
  const preset = providerPresets.value[providerForm.provider]
  if (preset) {
    providerForm.name = preset.name
    providerForm.base_url = preset.base_url
  } else {
    providerForm.name = ''
    providerForm.base_url = ''
  }
}

function openProviderCreate() {
  isProviderEdit.value = false
  providerForm.id = null
  providerForm.provider = ''
  providerForm.name = ''
  providerForm.api_key = ''
  providerForm.base_url = ''
  providerForm.is_active = true
  providerForm.sort_order = 0
  providerModalVisible.value = true
}

function openProviderEdit(row) {
  isProviderEdit.value = true
  Object.assign(providerForm, row, { api_key: '' })
  providerModalVisible.value = true
}

async function saveProvider() {
  if (!isProviderEdit.value && !providerForm.provider) {
    alert('请选择厂商')
    return
  }
  if (!providerForm.api_key && !isProviderEdit.value) {
    alert('请输入 API Key')
    return
  }

  providerSubmitting.value = true
  try {
    if (isProviderEdit.value) {
      const payload = {
        api_key: providerForm.api_key,
        is_active: providerForm.is_active,
        sort_order: providerForm.sort_order
      }
      if (!isPreset(providerForm.provider)) {
        payload.name = providerForm.name
        payload.base_url = providerForm.base_url
      }
      await adminApi.updateProvider(providerForm.id, payload)
    } else {
      await adminApi.createProvider({
        provider: providerForm.provider,
        api_key: providerForm.api_key,
        is_active: providerForm.is_active,
        sort_order: providerForm.sort_order
      })
    }
    providerModalVisible.value = false
    loadProviders()
  } catch (e) {
    alert(e.message)
  } finally {
    providerSubmitting.value = false
  }
}

async function handleDeleteProvider(row) {
  if (!confirm(`确定删除 Provider「${row.name}」吗？`)) return
  try {
    await adminApi.deleteProvider(row.id)
    loadProviders()
  } catch (e) {
    alert(e.message)
  }
}

async function handleTestProvider(row) {
  try {
    const res = await adminApi.testProvider(row.id)
    if (res.success) {
      alert(`连接成功，延迟 ${res.latency}ms`)
    } else {
      alert(`连接失败：${res.error || '未知错误'}`)
    }
  } catch (e) {
    alert(e.message)
  }
}

// 语音厂商弹窗
const voiceProviderModalVisible = ref(false)
const voiceProviderSubmitting = ref(false)
const isVoiceProviderEdit = ref(false)
const voiceProviderForm = reactive({
  id: null,
  provider: '',
  name: '',
  api_key: '',
  base_url: '',
  realtime_model: '',
  default_voice: '',
  is_active: true,
  sort_order: 0,
  _voices: [],
  _presetRealtimeModel: ''
})

function applyVoiceProviderPreset(provider) {
  const preset = voiceProviderPresets.value[provider]
  if (preset) {
    voiceProviderForm.name = preset.name
    voiceProviderForm.base_url = preset.base_url
    voiceProviderForm._voices = preset.voices || []
    voiceProviderForm._presetRealtimeModel = preset.realtime_model
    if (!voiceProviderForm.realtime_model) {
      voiceProviderForm.realtime_model = preset.realtime_model
    }
    if (!voiceProviderForm.default_voice || !voiceProviderForm._voices.includes(voiceProviderForm.default_voice)) {
      voiceProviderForm.default_voice = preset.voices[0] || ''
    }
  } else {
    voiceProviderForm.name = ''
    voiceProviderForm.base_url = ''
    voiceProviderForm._voices = []
    voiceProviderForm._presetRealtimeModel = ''
  }
}

function onVoiceProviderPresetChange() {
  applyVoiceProviderPreset(voiceProviderForm.provider)
}

function openVoiceProviderCreate() {
  isVoiceProviderEdit.value = false
  voiceProviderForm.id = null
  voiceProviderForm.provider = ''
  voiceProviderForm.name = ''
  voiceProviderForm.api_key = ''
  voiceProviderForm.base_url = ''
  voiceProviderForm.realtime_model = ''
  voiceProviderForm.default_voice = ''
  voiceProviderForm.is_active = true
  voiceProviderForm.sort_order = 0
  voiceProviderForm._voices = []
  voiceProviderForm._presetRealtimeModel = ''
  voiceProviderModalVisible.value = true
}

function openVoiceProviderEdit(row) {
  isVoiceProviderEdit.value = true
  Object.assign(voiceProviderForm, row, { api_key: '' })
  applyVoiceProviderPreset(row.provider)
  voiceProviderModalVisible.value = true
}

async function saveVoiceProvider() {
  if (!isVoiceProviderEdit.value && !voiceProviderForm.provider) {
    alert('请选择厂商')
    return
  }
  if (!voiceProviderForm.api_key && !isVoiceProviderEdit.value) {
    alert('请输入 API Key')
    return
  }

  voiceProviderSubmitting.value = true
  try {
    const payload = {
      api_key: voiceProviderForm.api_key,
      base_url: voiceProviderForm.base_url,
      realtime_model: voiceProviderForm.realtime_model,
      default_voice: voiceProviderForm.default_voice,
      is_active: voiceProviderForm.is_active,
      sort_order: voiceProviderForm.sort_order
    }
    if (isVoiceProviderEdit.value) {
      await adminApi.updateVoiceProvider(voiceProviderForm.id, payload)
    } else {
      await adminApi.createVoiceProvider({
        provider: voiceProviderForm.provider,
        ...payload
      })
    }
    voiceProviderModalVisible.value = false
    loadVoiceProviders()
  } catch (e) {
    alert(e.message)
  } finally {
    voiceProviderSubmitting.value = false
  }
}

async function updateVoiceProvider(row, data) {
  try {
    await adminApi.updateVoiceProvider(row.id, data)
    loadVoiceProviders()
  } catch (e) {
    alert(e.message)
  }
}

async function handleDeleteVoiceProvider(row) {
  if (!confirm(`确定删除语音厂商「${row.name}」吗？`)) return
  try {
    await adminApi.deleteVoiceProvider(row.id)
    loadVoiceProviders()
  } catch (e) {
    alert(e.message)
  }
}

async function handleTestVoiceProvider(row) {
  try {
    const res = await adminApi.testVoiceProvider(row.id)
    if (res.success) {
      alert(`连接成功，延迟 ${res.latency}ms`)
    } else {
      alert(`连接失败：${res.error || '未知错误'}`)
    }
  } catch (e) {
    alert(e.message)
  }
}

async function handleSetCurrentVoiceProvider(row) {
  try {
    await adminApi.setCurrentVoiceProvider(row.id)
    loadVoiceProviders()
  } catch (e) {
    alert(e.message)
  }
}

// 模型弹窗
const modelModalVisible = ref(false)
const modelSubmitting = ref(false)
const isModelEdit = ref(false)
const modelForm = reactive({
  id: null,
  name: '',
  provider: '',
  model_id: '',
  description: '',
  is_active: true,
  is_default: false,
  supports_vision: false,
  supports_web_search: false,
  max_tokens: 4096,
  sort_order: 0
})
const remoteModels = ref([])
const remoteModelsLoading = ref(false)
const remoteModelPick = ref('')

const canFetchRemoteModels = computed(() => {
  if (!modelForm.provider || isModelEdit.value) return false
  const row = providers.value.find(p => p.provider === modelForm.provider)
  return row && row.hasKey
})

function onModelProviderChange() {
  remoteModels.value = []
  remoteModelPick.value = ''
}

function openModelCreate() {
  isModelEdit.value = false
  modelForm.id = null
  modelForm.name = ''
  modelForm.provider = ''
  modelForm.model_id = ''
  modelForm.description = ''
  modelForm.is_active = true
  modelForm.is_default = false
  modelForm.supports_vision = false
  modelForm.supports_web_search = false
  modelForm.max_tokens = 4096
  modelForm.sort_order = 0
  remoteModels.value = []
  remoteModelPick.value = ''
  modelModalVisible.value = true
}

function openModelEdit(row) {
  isModelEdit.value = true
  Object.assign(modelForm, {
    ...row,
    is_active: !!row.is_active,
    is_default: !!row.is_default,
    supports_vision: !!row.supports_vision,
    supports_web_search: !!row.supports_web_search
  })
  remoteModels.value = []
  remoteModelPick.value = ''
  modelModalVisible.value = true
}

async function fetchRemoteModels() {
  const row = providers.value.find(p => p.provider === modelForm.provider)
  if (!row) return
  remoteModelsLoading.value = true
  try {
    remoteModels.value = await adminApi.getRemoteModels(row.id)
  } catch (e) {
    alert(e.message)
  } finally {
    remoteModelsLoading.value = false
  }
}

function onRemoteModelPick() {
  if (!remoteModelPick.value) return
  modelForm.model_id = remoteModelPick.value.id
  if (!modelForm.name) {
    modelForm.name = remoteModelPick.value.name
  }
}

async function saveModel() {
  if (!modelForm.provider || !modelForm.model_id || !modelForm.name) {
    alert('请填写厂商、模型 ID 和显示名称')
    return
  }

  modelSubmitting.value = true
  try {
    const payload = {
      name: modelForm.name,
      provider: modelForm.provider,
      model_id: modelForm.model_id,
      description: modelForm.description,
      is_active: modelForm.is_active,
      is_default: modelForm.is_default,
      supports_vision: modelForm.supports_vision,
      supports_web_search: modelForm.supports_web_search,
      max_tokens: modelForm.max_tokens,
      sort_order: modelForm.sort_order
    }
    if (isModelEdit.value) {
      await adminApi.updateModel(modelForm.id, payload)
    } else {
      await adminApi.createModel(payload)
    }
    modelModalVisible.value = false
    loadModels()
  } catch (e) {
    alert(e.message)
  } finally {
    modelSubmitting.value = false
  }
}

async function handleDeleteModel(row) {
  if (!confirm(`确定删除模型「${row.name}」吗？`)) return
  try {
    await adminApi.deleteModel(row.id)
    loadModels()
  } catch (e) {
    alert(e.message)
  }
}

async function updateModel(row, data) {
  try {
    await adminApi.updateModel(row.id, data)
    loadModels()
  } catch (e) {
    alert(e.message)
  }
}

onMounted(() => {
  loadProviderPresets()
  loadProviders()
  loadModels()
  loadVoiceProviderPresets()
  loadVoiceProviders()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

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

.inline-input {
  width: 80px;
  padding: 4px 8px;
  text-align: center;
  font-size: 13px;
}

.inline-select {
  min-width: 80px;
  padding: 4px 8px;
  font-size: 13px;
  background: transparent;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;
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

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .model-id-row {
    display: flex;
    gap: 10px;

    input {
      flex: 1;
    }
  }

  .remote-model-select {
    margin-top: 10px;
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: $text-secondary;
    font-size: 14px;

    input {
      width: auto;
    }
  }

  input:disabled,
  select:disabled {
    background: $bg-hover;
    color: $text-tertiary;
    cursor: not-allowed;
  }
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
