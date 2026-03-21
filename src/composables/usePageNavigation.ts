/**
 * Page navigation utilities for Vue frontend compatibility with HTML prototype
 * This provides the showProjectPage() integration mentioned in requirements
 */

import router from '../router'
import { useKeyMonitoring } from './useKeyMonitoring'

export function usePageNavigation() {
  const { startMonitoring, stopMonitoring, isMonitoring } = useKeyMonitoring()

  /**
   * Prototype: `showProjectPage('overview')` — one arg is section, use current route projectId.
   * Vue: `showProjectPage(projectId, section)` — two explicit args.
   */
  const showProjectPage = (projectIdOrSection: string, section?: string) => {
    const twoArg = section !== undefined
    const route = router.currentRoute.value
    const projectId = twoArg
      ? projectIdOrSection
      : typeof route.params.projectId === 'string'
        ? route.params.projectId
        : ''
    const sec = twoArg ? (section as string) : projectIdOrSection

    if (!projectId) {
      console.warn('showProjectPage: 缺少 projectId，请先进入某个项目上下文')
      return
    }

    console.log(`导航到项目页面: ${projectId}/${sec}`)

    if (isMonitoring.value) {
      console.log('页面切换前停止现有监控')
      stopMonitoring()
    }

    void router.push(`/projects/${projectId}/${sec}`)

    if (sec === 'keymanagement') {
      console.log('检测到Key管理页面，准备启动监控系统')
      setTimeout(() => {
        startMonitoring()
      }, 1500)
    }
  }

  /**
   * Enhanced page switching that maintains monitoring state
   */
  const switchToKeyManagement = (projectId: string) => {
    showProjectPage(projectId, 'keymanagement')
  }

  /**
   * Navigate away from key management with proper cleanup
   */
  const exitKeyManagement = (projectId: string, targetSection = 'overview') => {
    console.log('离开Key管理页面，执行清理操作')
    if (isMonitoring.value) {
      stopMonitoring()
    }
    showProjectPage(projectId, targetSection)
  }

  /**
   * Global navigation compatibility for HTML prototype integration
   */
  const showPage = (pageId: string) => {
    console.log(`全局页面导航: ${pageId}`)

    const globalPages: Record<string, string> = {
      dashboard: '/dashboard',
      projects: '/projects',
      efficiency: '/placeholder/efficiency',
      cicd: '/placeholder/cicd',
      envs: '/placeholder/envs',
      incidents: '/placeholder/incidents',
      workflows: '/placeholder/workflows',
      functions: '/placeholder/functions',
      'ai-monitor': '/placeholder/ai-monitor',
      evals: '/placeholder/evals',
      atomic: '/placeholder/atomic',
      knowledge: '/placeholder/knowledge',
      skills: '/placeholder/skills',
      templates: '/placeholder/templates',
      keys: '/placeholder/keys',
      audit: '/placeholder/audit',
      settings: '/placeholder/settings',
      'my-credential': '/placeholder/my-credential',
      'my-ability': '/placeholder/my-ability',
      'my-usage': '/placeholder/my-usage',
      'global-tools': '/placeholder/global-tools',
      integrations: '/placeholder/integrations',
      staff: '/placeholder/staff',
      permissions: '/placeholder/permissions',
      mcp: '/placeholder/mcp',
    }

    const targetPath = globalPages[pageId] ?? '/dashboard'

    // Stop monitoring when navigating away from key management
    if (isMonitoring.value) {
      console.log('全局导航时停止Key监控')
      stopMonitoring()
    }

    router.push(targetPath)
  }

  /**
   * Monitoring state management utilities
   */
  const getMonitoringStatus = () => ({
    isActive: isMonitoring.value,
    canStart: !isMonitoring.value,
    canStop: isMonitoring.value
  })

  return {
    // Main navigation functions
    showProjectPage,
    switchToKeyManagement,
    exitKeyManagement,
    showPage,

    // Monitoring integration
    getMonitoringStatus,

    // Direct monitoring controls (for manual usage)
    startMonitoring,
    stopMonitoring
  }
}

// Global function for HTML prototype compatibility
// This makes showProjectPage() available globally as mentioned in requirements
export const initGlobalPageNavigation = () => {
  const { showProjectPage, showPage } = usePageNavigation()

  // Attach to window for HTML prototype compatibility
  if (typeof window !== 'undefined') {
    ;(window as any).showProjectPage = showProjectPage
    ;(window as any).showPage = showPage
    console.log('全局页面导航函数已注册')
  }

  return { showProjectPage, showPage }
}