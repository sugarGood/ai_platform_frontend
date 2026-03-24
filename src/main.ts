import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { installGlobalErrorHandling } from './lib/global-error-handling'
import './styles/tokens.css'
import './styles/base.css'
/* 仅作用于 .page-shell 内，不污染弹层与侧栏 */
import './styles/prototype-ui.css'

const app = createApp(App)
installGlobalErrorHandling(app, { router })
app.use(router).mount('#app')
