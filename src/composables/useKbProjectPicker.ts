import { ref } from 'vue'

import { listProjects } from '../services/projects'

export interface KbProjectOption {
  id: number
  name: string
}

/**
 * 知识库新建/编辑弹窗：PROJECT 作用域下从后端拉取项目列表供下拉选择。
 */
export function useKbProjectPicker() {
  const projectOptions = ref<KbProjectOption[]>([])
  const projectsLoading = ref(false)
  const projectsLoadError = ref('')

  async function loadProjectOptions() {
    projectsLoading.value = true
    projectsLoadError.value = ''
    try {
      const res = await listProjects(1, 200)
      projectOptions.value = res.data.map((p) => ({ id: p.id, name: p.name }))
    } catch (e) {
      projectsLoadError.value = e instanceof Error ? e.message : '加载项目列表失败'
      projectOptions.value = []
    } finally {
      projectsLoading.value = false
    }
  }

  /** 编辑时若当前 projectId 不在列表中（已删项目等），补一条占位选项避免下拉空白 */
  function optionsWithFallback(selectedIdStr: string): KbProjectOption[] {
    const pid = Number(String(selectedIdStr).trim())
    const base = projectOptions.value
    if (!Number.isFinite(pid) || base.some((r) => r.id === pid)) {
      return base
    }
    return [{ id: pid, name: `项目 #${pid}（列表中无此项）` }, ...base]
  }

  return {
    projectOptions,
    projectsLoading,
    projectsLoadError,
    loadProjectOptions,
    optionsWithFallback,
  }
}
