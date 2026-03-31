import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { readStoredSession } from '../lib/auth-storage'
import LoginPage from '../features/auth/LoginPage.vue'
import DashboardPage from '../features/dashboard/DashboardPage.vue'
import GlobalKnowledgeDocumentsPage from '../features/global/GlobalKnowledgeDocumentsPage.vue'
import GlobalModulePage from '../features/global/GlobalModulePage.vue'
import MyCredentialPage from '../features/global/MyCredentialPage.vue'
import ProjectKnowledgeDocumentsPage from '../features/project/ProjectKnowledgeDocumentsPage.vue'
import ProjectModulePage from '../features/project/ProjectModulePage.vue'
import ProjectOverviewPage from '../features/project/ProjectOverviewPage.vue'
import ProjectLezhiAssistantPage from '../features/project/ProjectLezhiAssistantPage.vue'
import ServiceDetailPage from '../features/project/ServiceDetailPage.vue'
import ProjectsPage from '../features/projects/ProjectsPage.vue'
import PlatformCredentialPage from '../features/placeholder/PlatformCredentialPage.vue'
import StaffManagementPage from '../features/placeholder/StaffManagementPage.vue'
import PrototypeFullPage from '../features/prototype/PrototypeFullPage.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: {
      hideChrome: true,
      public: true,
      title: '登录',
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardPage,
    meta: {
      scope: 'global',
      title: '工作台',
      pageKey: 'dashboard',
    },
  },
  {
    path: '/projects',
    name: 'projects',
    component: ProjectsPage,
    meta: {
      scope: 'global',
      title: '项目空间',
      pageKey: 'projects',
    },
  },
  {
    path: '/projects/:projectId/overview',
    name: 'project-overview',
    component: ProjectOverviewPage,
    meta: {
      scope: 'project',
      title: '概览',
      pageKey: 'overview',
    },
  },
  {
    path: '/projects/:projectId/services/:serviceId',
    name: 'service-detail',
    component: ServiceDetailPage,
    meta: {
      scope: 'project',
      title: '服务详情',
      pageKey: 'service-detail',
    },
  },
  {
    path: '/projects/:projectId/lekai',
    name: 'project-lezhi',
    component: ProjectLezhiAssistantPage,
    meta: {
      scope: 'project',
      title: '乐知助手',
      pageKey: 'lekai',
    },
  },
  {
    path: '/projects/:projectId/knowledge/:kbId',
    name: 'project-knowledge-docs',
    component: ProjectKnowledgeDocumentsPage,
    meta: {
      scope: 'project',
      title: '知识库文档',
    },
  },
  {
    path: '/projects/:projectId/:section',
    name: 'project-module',
    component: ProjectModulePage,
    meta: {
      scope: 'project',
      title: '项目模块',
      pageKey: 'project-module',
    },
  },
  {
    path: '/placeholder/keys',
    name: 'placeholder-keys',
    component: PlatformCredentialPage,
    meta: {
      scope: 'global',
      title: '凭证管理',
      pageKey: 'keys',
    },
  },
  {
    path: '/placeholder/staff',
    name: 'placeholder-staff',
    component: StaffManagementPage,
    meta: {
      scope: 'global',
      title: '员工管理',
      pageKey: 'staff',
    },
  },
  {
    path: '/placeholder/my-credential',
    name: 'my-credential',
    component: MyCredentialPage,
    meta: {
      scope: 'global',
      title: '我的凭证',
      pageKey: 'my-credential',
    },
  },
  {
    path: '/placeholder/knowledge/:kbId',
    name: 'global-knowledge-docs',
    component: GlobalKnowledgeDocumentsPage,
    meta: {
      scope: 'global',
      title: '知识库文档',
    },
  },
  {
    path: '/placeholder/:pageKey',
    name: 'global-module',
    component: GlobalModulePage,
    meta: {
      scope: 'global',
      title: '平台模块',
      pageKey: 'global-module',
    },
  },
  /** 与桌面 HTML 原型 1:1（同套 HTML/CSS/JS，由 Vite public 托管） */
  {
    path: '/prototype',
    name: 'prototype-html',
    component: PrototypeFullPage,
    meta: {
      hideChrome: true,
      public: true,
      title: 'HTML 交互原型',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

function safePostLoginRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard'
  }
  return raw
}

router.beforeEach((to) => {
  const isPublic = to.meta.public === true

  if (isPublic) {
    if (to.name === 'login' && readStoredSession()) {
      return { path: safePostLoginRedirect(to.query.redirect), replace: true }
    }
    return true
  }

  if (!readStoredSession()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
