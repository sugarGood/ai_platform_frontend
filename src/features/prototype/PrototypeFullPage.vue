<script setup lang="ts">
/**
 * Pixel-perfect 1:1 with the HTML prototype: same markup, CSS and JS under /public/prototype.
 */
import { onMounted, ref, watchEffect } from 'vue'

const src = `${import.meta.env.BASE_URL}prototype/ai-platform-prototype.html`

const props = defineProps<{
  /**
   * Global page key, like: 'dashboard' | 'projects' | 'keys' | 'my-credential' ...
   * (maps to prototype showPage(name) => '#page-' + name)
   */
  initialPage?: string
  /**
   * Project-scoped entry, like enterProject(icon, name, status).
   */
  initialProject?: {
    icon: string
    name: string
    status: string
  }
  /**
   * Project section key for prototype showProjectPage(name),
   * like: 'overview' | 'workspace' | 'ai-cap' | 'keymanagement' | 'services' | 'incidents' | 'members' | 'psettings'
   */
  initialProjectSection?: string
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)

onMounted(() => {
  const iframe = iframeRef.value
  if (!iframe) return

  function navigate(win: any) {
    if (!win) return

    if (props.initialProject && typeof win.enterProject === 'function') {
      win.enterProject(props.initialProject.icon, props.initialProject.name, props.initialProject.status)
      if (props.initialProjectSection && typeof win.showProjectPage === 'function') {
        win.showProjectPage(props.initialProjectSection)
      }
      return
    }

    if (props.initialPage && typeof win.showPage === 'function') {
      win.showPage(props.initialPage)
    }
  }

  function tryNavigate() {
    const el = iframeRef.value
    if (!el) return
    try {
      const win = el.contentWindow as any
      navigate(win)
    } catch {
      // Ignore navigation failures in test / sandbox environments
    }
  }

  // Wait for prototype HTML to initialize window.PrototypePages and assign showPage/enterProject
  iframe.addEventListener(
    'load',
    () => {
      tryNavigate()
    },
    { once: true },
  )

  // Extra safety: attempt navigation once right after mounting.
  // (If iframe finished loading before listener attaches, this prevents blank initial state.)
  setTimeout(tryNavigate, 0)
})

// If props change without iframe remount, ensure we still try to navigate.
watchEffect(() => {
  // no-op: load handler is once; route changes should remount component anyway.
  // This placeholder keeps reactivity lint happy and documents intended behavior.
  void props.initialPage
})
</script>

<template>
  <iframe
    ref="iframeRef"
    class="prototype-iframe"
    title="AI 中台 · HTML 交互原型（1:1）"
    :src="src"
    :data-prototype-initial-page="props.initialPage ?? ''"
    :data-prototype-initial-project-name="props.initialProject?.name ?? ''"
    :data-prototype-initial-project-section="props.initialProjectSection ?? ''"
  />
</template>

<style scoped>
.prototype-iframe {
  display: block;
  width: 100%;
  height: 100vh;
  border: none;
  background: var(--bg-canvas, #f8fafc);
}
</style>
