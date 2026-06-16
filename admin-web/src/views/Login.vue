<template>
  <div class="login-page">
    <GlassCard class="login-card">
      <div class="login-card__brand">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#login-gradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <defs>
              <linearGradient id="login-gradient" x1="2" y1="12" x2="22" y2="12" gradientUnits="userSpaceOnUse">
                <stop stop-color="#6366f1" />
                <stop offset="1" stop-color="#4f46e5" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 class="brand-title">北斗星AI</h1>
        <p class="brand-subtitle">后台管理系统</p>
      </div>

      <div class="login-form">
        <div class="form-group">
          <label>管理员密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="请输入管理员密码"
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </div>

        <div v-if="error" class="login-error">{{ error }}</div>

        <GlowButton
          size="lg"
          :loading="loading"
          class="login-btn"
          @click="handleLogin"
        >
          登录
        </GlowButton>
      </div>
    </GlassCard>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import GlassCard from '@/components/GlassCard.vue'
import GlowButton from '@/components/GlowButton.vue'

const router = useRouter()
const adminStore = useAdminStore()

const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!password.value) {
    error.value = '请输入密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await adminStore.login(password.value)
    router.push('/dashboard')
  } catch (err) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.login-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f6f7f9 0%, #eef0f5 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;

  :deep(.glass-card__body) {
    padding: 40px;
  }

  &__brand {
    text-align: center;
    margin-bottom: 32px;
  }

  .brand-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 16px;
    background: rgba($primary, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-title {
    font-size: 26px;
    font-weight: 700;
    margin: 0 0 6px;
    color: $text;
  }

  .brand-subtitle {
    font-size: 14px;
    color: $text-secondary;
    margin: 0;
  }
}

.login-form {
  .form-group {
    margin-bottom: 20px;

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: $text-secondary;
    }
  }

  .login-error {
    color: $pink;
    font-size: 13px;
    margin-bottom: 16px;
    text-align: center;
  }

  .login-btn {
    width: 100%;
  }
}
</style>
