import { ref, watch, type ComputedRef } from 'vue'

import { loadProjectWorkspaceModuleSections } from '../lib/load-project-workspace'
import type { ModuleSection } from '../types/module-page'

export function useProjectWorkspaceApi(opts: {
  projectIdStr: ComputedRef<string | undefined>
  projectName: ComputedRef<string>
  projectCode: ComputedRef<string | undefined>
  section: ComputedRef<string>
  userId: ComputedRef<number | undefined>
  roleLabel: ComputedRef<string>
  getKnowledgeSkillToolCounts: () => { kb: number; sk: number; tl: number }
}) {
  const workspaceSections = ref<ModuleSection[] | null>(null)
  const workspaceLoading = ref(false)
  const workspaceError = ref<string | null>(null)

  async function reloadWorkspace() {
    const pid = opts.projectIdStr.value
    const uid = opts.userId.value
    if (!pid || !/^\d+$/.test(pid) || uid == null) {
      workspaceSections.value = null
      workspaceError.value = null
      workspaceLoading.value = false
      return
    }

    workspaceLoading.value = true
    workspaceError.value = null
    try {
      const { kb, sk, tl } = opts.getKnowledgeSkillToolCounts()
      workspaceSections.value = await loadProjectWorkspaceModuleSections({
        projectId: Number(pid),
        projectName: opts.projectName.value || `项目 ${pid}`,
        projectCode: (opts.projectCode.value ?? pid).trim(),
        currentUserId: uid,
        roleLabel: opts.roleLabel.value,
        knowledgeCount: kb,
        skillCount: sk,
        toolCount: tl,
      })
    } catch (e) {
      workspaceError.value = e instanceof Error ? e.message : String(e)
      workspaceSections.value = null
    } finally {
      workspaceLoading.value = false
    }
  }

  watch(
    () => [opts.section.value, opts.projectIdStr.value, opts.userId.value] as const,
    ([sec]) => {
      if (sec === 'workspace') void reloadWorkspace()
    },
    { immediate: true },
  )

  return {
    workspaceSections,
    workspaceLoading,
    workspaceError,
    reloadWorkspace,
  }
}
