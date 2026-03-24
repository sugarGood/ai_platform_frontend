<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '../../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { login, isAuthenticated } = useAuth()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

const showDevHint = computed(() => import.meta.env.DEV)

function safeRedirectPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard'
  }
  return raw
}

onMounted(() => {
  if (isAuthenticated.value) {
    void router.replace(safeRedirectPath(route.query.redirect))
  }
})

async function onSubmit() {
  error.value = ''
  const em = email.value.trim()
  const p = password.value
  if (!em || !p) {
    error.value = '请输入邮箱与密码'
    return
  }
  submitting.value = true
  try {
    await login(em, p)
    await router.replace(safeRedirectPath(route.query.redirect))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-root">
    <div class="login-bg" aria-hidden="true">
      <div class="grid" />
      <div class="glow glow-a" />
      <div class="glow glow-b" />
      <div class="scanline" />
    </div>

    <div class="login-layout">
      <section class="login-hero">
        <div class="hero-badge">NEURAL OPS GATEWAY</div>
        <h1 class="hero-title">
          <span class="hero-glitch" data-text="AI 中台">AI 中台</span>
        </h1>
        <p class="hero-desc">统一编排模型、工具与知识的企业级智能基础设施。安全接入，实时可观测。</p>
        <ul class="hero-stats">
          <li><span class="stat-num">∞</span><span class="stat-label">弹性算力</span></li>
          <li><span class="stat-num">AES-256</span><span class="stat-label">链路加密</span></li>
          <li><span class="stat-num">OIDC</span><span class="stat-label">身份联邦</span></li>
        </ul>
      </section>

      <div class="login-card-wrap">
        <div class="login-card">
          <div class="card-corner card-corner-tl" />
          <div class="card-corner card-corner-br" />

          <header class="card-head">
            <h2>身份验证</h2>
            <p>请输入凭据以建立安全会话</p>
          </header>

          <form class="login-form" @submit.prevent="onSubmit">
            <label class="field">
              <span class="field-label">邮箱</span>
              <input
                v-model="email"
                autocomplete="email"
                class="field-input"
                placeholder="name@company.com"
                type="email"
              />
            </label>
            <label class="field">
              <span class="field-label">密码</span>
              <input
                v-model="password"
                autocomplete="current-password"
                class="field-input"
                placeholder="••••••••"
                type="password"
              />
            </label>

            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <p v-if="showDevHint" class="form-hint">
              本地无后端时可用演示邮箱 <code>demo@local.dev</code>，密码 <code>demo</code>
            </p>

            <button class="submit-btn" :disabled="submitting" type="submit">
              <span class="submit-label">{{ submitting ? '校验中…' : '进入平台' }}</span>
              <span class="submit-glow" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-root {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse 120% 80% at 50% -20%, #1a2744 0%, transparent 55%), #050810;
  color: #e8edf7;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid {
  position: absolute;
  inset: -50%;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  transform: perspective(400px) rotateX(58deg) translateY(-12%);
  mask-image: radial-gradient(ellipse 70% 55% at 50% 40%, black 20%, transparent 70%);
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
  animation: float 14s ease-in-out infinite;
}

.glow-a {
  width: 420px;
  height: 420px;
  left: -8%;
  top: 15%;
  background: #22d3ee;
  animation-delay: 0s;
}

.glow-b {
  width: 380px;
  height: 380px;
  right: -5%;
  bottom: 5%;
  background: #6366f1;
  animation-delay: -7s;
}

.scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.12) 2px,
    rgba(0, 0, 0, 0.12) 4px
  );
  opacity: 0.25;
  mix-blend-mode: overlay;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(24px, -18px) scale(1.05);
  }
}

.login-layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 420px);
  gap: clamp(24px, 5vw, 64px);
  align-items: center;
  width: 100%;
  max-width: 1040px;
  padding: clamp(24px, 4vw, 48px);
}

@media (max-width: 880px) {
  .login-layout {
    grid-template-columns: 1fr;
    padding-top: 32px;
  }

  .login-hero {
    text-align: center;
    align-items: center;
  }

  .hero-stats {
    justify-content: center;
  }
}

.login-hero {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hero-badge {
  align-self: flex-start;
  font-size: 11px;
  letter-spacing: 0.28em;
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.08);
  font-weight: 600;
}

@media (max-width: 880px) {
  .hero-badge {
    align-self: center;
  }
}

.hero-title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.15;
}

.hero-glitch {
  position: relative;
  color: #f8fafc;
  text-shadow:
    0 0 24px rgba(56, 189, 248, 0.35),
    0 0 48px rgba(99, 102, 241, 0.2);
}

.hero-glitch::after {
  content: attr(data-text);
  position: absolute;
  left: 2px;
  top: 0;
  color: #22d3ee;
  opacity: 0.5;
  clip-path: inset(0 0 55% 0);
  animation: glitch 3.5s linear infinite;
}

@keyframes glitch {
  0%,
  90%,
  100% {
    transform: translate(0);
  }
  92% {
    transform: translate(-2px, 1px);
  }
  94% {
    transform: translate(2px, -1px);
  }
}

.hero-desc {
  margin: 0;
  max-width: 36rem;
  color: #94a3b8;
  font-size: 15px;
  line-height: 1.65;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 28px;
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.hero-stats li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-num {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 15px;
  color: #67e8f9;
  font-weight: 600;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.login-card-wrap {
  perspective: 1200px;
}

.login-card {
  position: relative;
  padding: 36px 32px 32px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.75));
  border: 1px solid rgba(56, 189, 248, 0.22);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 24px 64px rgba(0, 0, 0, 0.45),
    0 0 80px rgba(56, 189, 248, 0.08);
  backdrop-filter: blur(12px);
}

.card-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: #38bdf8;
  border-style: solid;
  opacity: 0.7;
  pointer-events: none;
}

.card-corner-tl {
  top: 10px;
  left: 10px;
  border-width: 2px 0 0 2px;
}

.card-corner-br {
  bottom: 10px;
  right: 10px;
  border-width: 0 2px 2px 0;
}

.card-head h2 {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 700;
}

.card-head p {
  margin: 0 0 28px;
  font-size: 13px;
  color: #94a3b8;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.field-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.55);
  color: #f1f5f9;
  font-size: 15px;
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.field-input::placeholder {
  color: #475569;
}

.field-input:focus {
  border-color: rgba(56, 189, 248, 0.65);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.18);
}

.form-error {
  margin: 0;
  font-size: 13px;
  color: #f87171;
}

.form-hint {
  margin: -4px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.form-hint code {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.12);
  color: #7dd3fc;
}

.submit-btn {
  position: relative;
  margin-top: 8px;
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #020617;
  background: linear-gradient(105deg, #22d3ee, #818cf8 55%, #a78bfa);
  overflow: hidden;
  transition:
    transform 0.15s,
    filter 0.15s;
}

.submit-btn:hover:not(:disabled) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.submit-label {
  position: relative;
  z-index: 1;
}

.submit-glow {
  position: absolute;
  inset: -40%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, transparent 65%);
  opacity: 0;
  animation: pulse 2.8s ease-in-out infinite;
}

.submit-btn:hover:not(:disabled) .submit-glow {
  opacity: 0.35;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(0.85);
    opacity: 0.2;
  }
  50% {
    transform: scale(1);
    opacity: 0.45;
  }
}
</style>
