<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useOverlay } from '../../composables/useOverlay'
import { useProjects } from '../../composables/useProjects'

const router = useRouter()
const { openNewProjectModal } = useOverlay()
const { loadProjects, projectSummaries } = useProjects()

onMounted(() => {
  void loadProjects()
})

function goPage(pageKey: string) {
  void router.push(`/placeholder/${pageKey}`)
}

function enterByName(name: string) {
  const id = projectSummaries.value.find((p) => p.name === name)?.id
  if (id) void router.push(`/projects/${id}/overview`)
  else void router.push('/projects')
}
</script>

<template>
  <section class="dashboard-proto" data-testid="dashboard-page">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🤖</div>
        <div class="stat-label">本月 Token 消耗</div>
        <div class="stat-value" style="color: var(--primary)">2.4M</div>
        <div class="stat-delta">↑ 12% 较上月</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🪪</div>
        <div class="stat-label">活跃平台凭证</div>
        <div class="stat-value">38</div>
        <div class="stat-delta">↑ 5 本周新增</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-label">本月技能调用</div>
        <div class="stat-value" style="color: var(--success)">1,847</div>
        <div class="stat-delta">↑ 23% 较上月</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-label">凭证即将过期</div>
        <div class="stat-value" style="color: var(--warning)">4</div>
        <div class="stat-delta down">7 天内过期</div>
      </div>
    </div>

    <div style="font-size: 13px; font-weight: 700; color: var(--sub); margin-bottom: 10px">📁 我参与的项目</div>
    <div class="grid-3" style="margin-bottom: 20px">
      <div
        class="project-card"
        role="button"
        tabindex="0"
        @click="enterByName('商城系统')"
        @keydown.enter="enterByName('商城系统')"
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
          <span style="font-size: 18px">🛒</span>
          <span class="badge badge-green">进行中</span>
        </div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px">商城系统</div>
        <div style="font-size: 12px; color: var(--sub)">AI 能力 5/6 · 完成度 58% · 6 名成员</div>
        <div style="display: flex; gap: 6px; margin-top: 8px">
          <span class="project-tag">知识库 12</span><span class="project-tag">技能 4</span
          ><span class="project-tag">工具 8</span>
        </div>
      </div>
      <div
        class="project-card"
        role="button"
        tabindex="0"
        @click="enterByName('用户中心')"
        @keydown.enter="enterByName('用户中心')"
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
          <span style="font-size: 18px">👤</span>
          <span class="badge badge-green">进行中</span>
        </div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px">用户中心</div>
        <div style="font-size: 12px; color: var(--sub)">AI 能力 4/4 · 完成度 72% · 4 名成员</div>
        <div style="display: flex; gap: 6px; margin-top: 8px">
          <span class="project-tag">知识库 8</span><span class="project-tag">技能 3</span
          ><span class="project-tag">工具 5</span>
        </div>
      </div>
      <div
        class="project-card"
        role="button"
        tabindex="0"
        @click="enterByName('支付网关')"
        @keydown.enter="enterByName('支付网关')"
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
          <span style="font-size: 18px">💳</span>
          <span class="badge badge-blue">测试中</span>
        </div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px">支付网关</div>
        <div style="font-size: 12px; color: var(--sub)">AI 能力 4/5 · 完成度 40% · 5 名成员</div>
        <div style="display: flex; gap: 6px; margin-top: 8px">
          <span class="project-tag">知识库 6</span><span class="project-tag">技能 2</span
          ><span class="project-tag">工具 4</span>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom: 20px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 待处理事项</span>
          <span class="badge badge-yellow">5 项待办</span>
        </div>
        <div class="card-body" style="padding: 0 16px">
          <div class="skill-item" role="button" tabindex="0" @click="goPage('keys')">
            <div class="skill-icon" style="background: #fef3f2">⚠️</div>
            <div style="flex: 1">
              <div class="skill-name">3 个平台凭证即将过期</div>
              <div class="skill-desc">张三、王五、赵六 的凭证将在 7 天内过期，需提醒续签</div>
            </div>
            <span class="badge badge-red" style="font-size: 11px">紧急</span>
          </div>
          <div class="skill-item" role="button" tabindex="0" @click="goPage('skills')">
            <div class="skill-icon" style="background: #fff6ed">📝</div>
            <div style="flex: 1">
              <div class="skill-name">2 个技能待审核发布</div>
              <div class="skill-desc">「安全扫描」「API 文档生成」提交审核，等待管理员审批</div>
            </div>
            <span class="badge badge-yellow" style="font-size: 11px">审核</span>
          </div>
          <div class="skill-item" role="button" tabindex="0" @click="goPage('knowledge')">
            <div class="skill-icon" style="background: #eef1ff">📚</div>
            <div style="flex: 1">
              <div class="skill-name">知识库文档 3 篇待更新</div>
              <div class="skill-desc">编码规范 v2.1、API 设计指南、安全合规文档有新版本</div>
            </div>
            <span class="badge badge-blue" style="font-size: 11px">更新</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">🎯 平台成功指标</span>
          <span style="font-size: 12px; color: var(--sub)">PRD 定义 · 实时追踪</span>
        </div>
        <div class="card-body" style="padding: 12px 16px">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">成员接入耗时</div>
              <div style="font-weight: 700">平均 2.1 分钟</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 达标</span>
              <div style="font-size: 11px; color: var(--sub)">目标 ≤ 3 分钟</div>
            </div>
          </div>
          <div style="background: var(--bg); border-radius: 4px; height: 6px; margin-bottom: 16px">
            <div style="background: var(--success); height: 100%; border-radius: 4px; width: 70%" />
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">知识库命中率</div>
              <div style="font-weight: 700">78%</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 达标</span>
              <div style="font-size: 11px; color: var(--sub)">目标 ≥ 70%</div>
            </div>
          </div>
          <div style="background: var(--bg); border-radius: 4px; height: 6px; margin-bottom: 16px">
            <div style="background: var(--success); height: 100%; border-radius: 4px; width: 78%" />
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">技能复用率</div>
              <div style="font-weight: 700">68 次/技能/月</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 达标</span>
              <div style="font-size: 11px; color: var(--sub)">目标 ≥ 50 次/技能</div>
            </div>
          </div>
          <div style="background: var(--bg); border-radius: 4px; height: 6px; margin-bottom: 16px">
            <div style="background: var(--success); height: 100%; border-radius: 4px; width: 68%" />
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">凭证安全事件</div>
              <div style="font-weight: 700">0 起</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 安全</span>
              <div style="font-size: 11px; color: var(--sub)">目标 0 起泄露</div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div>
              <div style="font-size: 12px; color: var(--sub)">代理延迟增量</div>
              <div style="font-weight: 700">P99 142ms</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 达标</span>
              <div style="font-size: 11px; color: var(--sub)">目标 ≤ 200ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap">
      <button class="btn" type="button" @click="goPage('my-credential')">🪪 查看我的凭证</button>
      <button class="btn" type="button" @click="goPage('my-ability')">🧩 查看可用能力</button>
      <button class="btn" type="button" @click="goPage('integrations')">🔌 集成市场</button>
      <button class="btn" type="button" @click="goPage('skills')">⚡ 全局技能库</button>
      <button class="btn btn-primary" type="button" style="margin-left: auto" @click="openNewProjectModal">
        + 新建项目
      </button>
    </div>

    <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px">
      <div class="card" data-testid="dashboard-activity-card">
        <div class="card-header">
          <span class="card-title">📋 平台动态</span>
        </div>
        <div class="card-body" style="padding: 16px 20px">
          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-dot" />
              <div class="timeline-time">10分钟前</div>
              <div class="timeline-content">
                <strong>李四</strong> 在 <strong>商城系统</strong> 中更新了需求文档
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-dot" />
              <div class="timeline-time">1小时前</div>
              <div class="timeline-content">
                <strong>王五</strong> 平台凭证成功接入 Claude Code，可用技能 12 个
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-dot" />
              <div class="timeline-time">2小时前</div>
              <div class="timeline-content">AI 为 <strong>用户中心</strong> 项目生成了接口文档（/doc-gen 技能）</div>
            </div>
            <div class="timeline-item">
              <div class="timeline-dot" />
              <div class="timeline-time">昨天</div>
              <div class="timeline-content"><strong>张三</strong> 新建项目 <strong>数据看板</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
