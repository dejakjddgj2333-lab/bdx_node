import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import adminApi from '@/api/admin'

export const useAdminStore = defineStore('admin', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const adminInfo = ref(JSON.parse(localStorage.getItem('admin_info') || 'null'))
  const sidebarCollapsed = ref(false)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(value) {
    token.value = value
    localStorage.setItem('admin_token', value)
  }

  function setAdminInfo(info) {
    adminInfo.value = info
    localStorage.setItem('admin_info', JSON.stringify(info))
  }

  async function login(password) {
    const data = await adminApi.login(password)
    setToken(data.token)
    setAdminInfo({ username: 'admin' })
    return data
  }

  async function fetchProfile() {
    const data = await adminApi.profile()
    setAdminInfo(data)
    return data
  }

  function logout() {
    token.value = ''
    adminInfo.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_info')
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    token,
    adminInfo,
    sidebarCollapsed,
    isLoggedIn,
    setToken,
    setAdminInfo,
    login,
    fetchProfile,
    logout,
    toggleSidebar
  }
})
