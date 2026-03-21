<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import GlobalSidebar from '../components/shell/GlobalSidebar.vue'
import ProjectSidebar from '../components/shell/ProjectSidebar.vue'
import TopBar from '../components/shell/TopBar.vue'
import AppOverlay from '../components/ui/AppOverlay.vue'
import { useAppShell } from '../composables/useAppShell'
import { useOverlay } from '../composables/useOverlay'

const route = useRoute()
const hideChrome = computed(() => route.meta.hideChrome === true)

const { isProjectScope, topbarTitle } = useAppShell()
const { resetOverlayState } = useOverlay()

onMounted(() => {
  resetOverlayState()
})
</script>

<template>
  <RouterView v-if="hideChrome" />

  <div v-else class="app-frame" data-testid="app-shell">
    <GlobalSidebar v-if="!isProjectScope" />
    <ProjectSidebar v-else />

    <div class="content-frame">
      <TopBar :project-scoped="isProjectScope" :title="topbarTitle" />

      <main class="page-scroll">
        <div class="page-shell">
          <RouterView />
        </div>
      </main>
    </div>

    <AppOverlay />
  </div>
</template>
