import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import DashboardPage from '../features/dashboard/DashboardPage.vue'
import GlobalModulePage from '../features/global/GlobalModulePage.vue'
import ProjectModulePage from '../features/project/ProjectModulePage.vue'
import ProjectOverviewPage from '../features/project/ProjectOverviewPage.vue'
import ServiceDetailPage from '../features/project/ServiceDetailPage.vue'
import ProjectsPage from '../features/projects/ProjectsPage.vue'
import PlatformCredentialPage from '../features/placeholder/PlatformCredentialPage.vue'
import PrototypeFullPage from '../features/prototype/PrototypeFullPage.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
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

export default router
