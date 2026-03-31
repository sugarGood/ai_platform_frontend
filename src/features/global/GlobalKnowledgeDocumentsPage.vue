<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import KnowledgeDocumentsWorkspace from '../knowledge/KnowledgeDocumentsWorkspace.vue'

const route = useRoute()

const kbId = computed(() => {
  const raw = route.params.kbId
  const n = typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(n) ? n : NaN
})
</script>

<template>
  <KnowledgeDocumentsWorkspace
    :kb-id="kbId"
    back-path="/placeholder/knowledge"
    back-label="← 返回知识库列表"
    test-id="global-knowledge-docs-page"
  />
</template>
