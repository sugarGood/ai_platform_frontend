import type { App } from 'vue'
import type { Router } from 'vue-router'

let installed = false

/** 将任意异常值整理为可读字符串（用于日志与开发态提示） */
export function formatUnknownError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim()
  }
  if (typeof err === 'string' && err.trim()) {
    return err.trim()
  }
  try {
    const s = JSON.stringify(err)
    if (s !== undefined) return s
  } catch {
    /* ignore */
  }
  return String(err)
}

function userFacingMessage(err: unknown): string {
  if (import.meta.env.DEV) {
    return formatUnknownError(err)
  }
  return '系统出现异常，请稍后重试。若问题持续，请联系管理员。'
}

function showGlobalErrorToast(message: string) {
  if (typeof document === 'undefined') return

  let stack = document.getElementById('global-error-stack')
  if (!stack) {
    stack = document.createElement('div')
    stack.id = 'global-error-stack'
    stack.dataset.testid = 'global-error-stack'
    stack.style.cssText =
      'position:fixed;top:72px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:min(360px,92vw);'
    document.body.appendChild(stack)
  }

  const el = document.createElement('div')
  el.setAttribute('role', 'alert')
  el.textContent = message
  el.style.cssText =
    'pointer-events:auto;min-width:220px;padding:12px 14px;border-radius:10px;font-size:13px;line-height:1.45;color:#fff;background:rgba(185,28,28,0.94);box-shadow:0 10px 24px rgba(15,22,41,0.22);'
  stack.appendChild(el)

  const ttl = 6000
  window.setTimeout(() => {
    el.remove()
    if (stack && stack.childElementCount === 0) {
      stack.remove()
    }
  }, ttl)
}

function report(source: string, err: unknown, extra?: Record<string, unknown>) {
  if (extra && Object.keys(extra).length > 0) {
    console.error(`[global-error] ${source}`, err, extra)
  } else {
    console.error(`[global-error] ${source}`, err)
  }
}

function handleCaught(source: string, err: unknown, extra?: Record<string, unknown>) {
  report(source, err, extra)
  showGlobalErrorToast(userFacingMessage(err))
}

/**
 * 注册全局异常处理：Vue 渲染错误、未捕获的同步错误、未处理的 Promise 拒绝、路由异步块加载失败。
 * 仅应调用一次（通常在 main.ts）。
 */
export function installGlobalErrorHandling(app: App, options?: { router?: Router }) {
  if (installed) {
    return
  }
  installed = true

  app.config.errorHandler = (err, _instance, info) => {
    handleCaught('vue', err, { info })
  }

  window.addEventListener('error', (event) => {
    if (event.defaultPrevented) return
    // 图片/脚本等资源加载失败会冒泡到 window，与 JS 运行时错误区分，避免误报 Toast
    const t = event.target
    if (t && t !== window && t instanceof EventTarget && 'tagName' in t) {
      return
    }
    const err = event.error ?? event.message
    handleCaught('window.error', err, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    handleCaught('unhandledrejection', event.reason)
  })

  const router = options?.router
  if (router) {
    router.onError((err) => {
      handleCaught('router', err)
    })
  }
}
