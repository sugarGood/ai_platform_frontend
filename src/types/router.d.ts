import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    hideChrome?: boolean
    /** 无需登录即可访问 */
    public?: boolean
    scope?: 'global' | 'project'
    title?: string
    pageKey?: string
  }
}

export {}
