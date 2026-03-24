import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { GLOBAL_PAGE_TITLES, PROJECT_SECTION_TITLES } from '../constants/prototypeTitles'
import { getProjectById } from './useProjects'

export function useAppShell() {
  const route = useRoute()

  const isProjectScope = computed(() => route.meta.scope === 'project')

  const currentProject = computed(() => {
    if (typeof route.params.projectId !== 'string') {
      return undefined
    }

    return getProjectById(route.params.projectId)
  })

  const topbarTitle = computed(() => {
    if (isProjectScope.value) {
      const projectName = currentProject.value?.name ?? '项目不存在'
      if (route.name === 'project-overview') {
        return `${projectName} · ${PROJECT_SECTION_TITLES.overview}`
      }
      if (route.name === 'service-detail') {
        const t = typeof route.meta.title === 'string' ? route.meta.title : '服务详情'
        return `${projectName} · ${t}`
      }
      if (route.name === 'project-lezhi') {
        return `${projectName} · 乐知助手`
      }
      if (route.name === 'project-module' && typeof route.params.section === 'string') {
        const sec = PROJECT_SECTION_TITLES[route.params.section] ?? route.params.section
        return `${projectName} · ${sec}`
      }
      return projectName
    }

    if (route.name === 'global-module' && typeof route.params.pageKey === 'string') {
      return GLOBAL_PAGE_TITLES[route.params.pageKey] ?? '平台模块'
    }

    if (route.name === 'global-knowledge-docs') {
      return '知识库文档'
    }

    return typeof route.meta.title === 'string' ? route.meta.title : 'AI 中台'
  })

  return {
    currentProject,
    isProjectScope,
    topbarTitle,
  }
}
