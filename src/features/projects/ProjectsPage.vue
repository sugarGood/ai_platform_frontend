<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ProjectCard from '../../components/ui/ProjectCard.vue'
import ProjectTable from '../../components/ui/ProjectTable.vue'
import { useProjects } from '../../composables/useProjects'
import { useOverlay } from '../../composables/useOverlay'

const router = useRouter()
const { openNewProjectModal } = useOverlay()
const { loadProjects, projectState, projectSummaries } = useProjects()

onMounted(() => {
  void loadProjects()
})

async function enterProject(projectId: string) {
  await router.push(`/projects/${projectId}/overview`)
}
</script>

<template>
  <section class="projects-page" data-testid="projects-page">
    <div v-if="projectState.error" class="proto-banner proto-banner--error" data-testid="projects-error-banner">
      无法从后端加载项目列表，请检查网络或 API 配置。
      <span class="proto-banner-detail">{{ projectState.error }}</span>
    </div>

    <div
      v-else-if="projectState.loading && !projectState.loadedFromApi"
      class="proto-banner"
      data-testid="projects-loading-banner"
    >
      正在加载后端项目列表...
    </div>

    <div style="display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap">
      <input placeholder="搜索项目..." style="max-width: 280px" type="search" />
      <select style="width: auto">
        <option>全部状态</option>
        <option>进行中</option>
        <option>已完成</option>
      </select>
      <button class="btn btn-primary" data-testid="new-project-entry" style="margin-left: auto" type="button" @click="openNewProjectModal">
        + 新建项目
      </button>
    </div>

    <template v-if="projectSummaries.length">
      <div class="grid-3" style="margin-bottom: 20px">
        <ProjectCard
          v-for="project in projectSummaries.slice(0, 3)"
          :key="project.id"
          :project="project"
          @click="enterProject"
        />
      </div>

      <ProjectTable :projects="projectSummaries" @select="enterProject" />
    </template>

    <section v-else-if="projectState.error" class="proto-empty" data-testid="projects-empty-state">
      <h2>暂无项目数据</h2>
      <p>请查看上方错误信息后重试，或检查 Vite 代理与 <code>VITE_API_BASE_URL</code> 配置。</p>
    </section>

    <section v-else class="proto-empty" data-testid="projects-empty-state">
      <h2>还没有项目</h2>
      <p>后端已返回空列表。点击「+ 新建项目」创建第一个项目。</p>
    </section>
  </section>
</template>

<style scoped>
.projects-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.proto-banner {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  color: var(--sub);
  font-size: 13px;
  line-height: 1.6;
}

.proto-banner--error {
  border-color: #fecdca;
  background: #fef3f2;
  color: var(--text);
}

.proto-banner-detail {
  display: block;
  margin-top: 4px;
  word-break: break-word;
}

.proto-empty {
  margin-top: 16px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
}

.proto-empty h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.proto-empty p {
  margin: 10px 0 0;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.7;
}
</style>
