import { createRouter, createWebHashHistory } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/components/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '概览', icon: 'dashboard' }
      },
      {
        path: '/users',
        name: 'UserManage',
        component: () => import('@/views/UserManage.vue'),
        meta: { title: '用户管理', icon: 'users' }
      },
      {
        path: '/knowledge',
        name: 'KnowledgeBase',
        component: () => import('@/views/KnowledgeBase.vue'),
        meta: { title: '知识库', icon: 'knowledge' }
      },
      {
        path: '/knowledge/:id',
        name: 'KnowledgeBaseDetail',
        component: () => import('@/views/KnowledgeBaseDetail.vue'),
        meta: { title: '知识库详情', hidden: true }
      },
      {
        path: '/models',
        name: 'ModelConfig',
        component: () => import('@/views/ModelConfig.vue'),
        meta: { title: '模型配置', icon: 'model' }
      },
      {
        path: '/image-models',
        name: 'ImageModelConfig',
        component: () => import('@/views/ImageModelConfig.vue'),
        meta: { title: '绘图模型', icon: 'image' }
      },
      {
        path: '/system-settings',
        name: 'SystemSettings',
        component: () => import('@/views/SystemSettings.vue'),
        meta: { title: '系统设置', icon: 'settings' }
      },
      {
        path: '/prompt-suggestions',
        name: 'PromptSuggestions',
        component: () => import('@/views/PromptSuggestions.vue'),
        meta: { title: '推荐语配置', icon: 'sparkle' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const store = useAdminStore()
  const isPublic = to.meta?.public

  if (!isPublic && !store.isLoggedIn) {
    next('/login')
    return
  }

  if (isPublic && store.isLoggedIn && to.path === '/login') {
    next('/dashboard')
    return
  }

  next()
})

export default router
