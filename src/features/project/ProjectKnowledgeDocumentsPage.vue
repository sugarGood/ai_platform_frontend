<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import KnowledgeDocumentsWorkspace from '../knowledge/KnowledgeDocumentsWorkspace.vue'

const route = useRoute()

const projectId = computed(() => (typeof route.params.projectId === 'string' ? route.params.projectId : ''))

const kbId = computed(() => {
  const raw = route.params.kbId
  const n = typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(n) ? n : NaN
})

const backPath = computed(() => `/projects/${projectId.value}/knowledge`)
</script>

<template>
  <KnowledgeDocumentsWorkspace
    :kb-id="kbId"
    :back-path="backPath"
    back-label="← 返回项目知识库"
    test-id="project-knowledge-docs-page"
  />
</template>
