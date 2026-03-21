import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/base.css'
/* 仅作用于 .page-shell 内，不污染弹层与侧栏 */
import './styles/prototype-ui.css'

createApp(App).use(router).mount('#app')
