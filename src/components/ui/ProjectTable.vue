<script setup lang="ts">
import type { ProjectSummary } from '../../types/project'

defineProps<{
  projects: ProjectSummary[]
}>()

function isNumericProjectId(id: string) {
  return /^\d+$/.test(id)
}

const emit = defineEmits<{
  select: [projectId: string]
  edit: [projectId: string]
}>()

function onEditClick(projectId: string, event: MouseEvent) {
  event.stopPropagation()
  emit('edit', projectId)
}
</script>

<template>
  <div class="table-shell">
    <table class="project-table">
      <thead>
        <tr>
          <th>项目</th>
          <th>类型</th>
          <th>代码服务</th>
          <th>成员</th>
          <th>AI 能力状态</th>
          <th>本月 Token</th>
          <th>状态</th>
          <th class="project-table-actions-col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="project in projects"
          :key="project.id"
          :data-project-id="project.id"
          @click="emit('select', project.id)"
        >
          <td>{{ project.icon }} {{ project.name }}</td>
          <td>{{ project.typeLabel }}</td>
          <td>{{ project.serviceCount }} 个服务</td>
          <td>{{ project.memberCount }} 人</td>
          <td>{{ project.aiCapabilityLabel }}</td>
          <td>{{ project.tokenLabel }}</td>
          <td>{{ project.statusLabel }}</td>
          <td class="project-table-actions-col" @click.stop>
            <button
              v-if="isNumericProjectId(project.id)"
              type="button"
              class="project-table-edit"
              data-testid="project-table-edit"
              @click="onEditClick(project.id, $event)"
            >
              编辑
            </button>
            <span v-else class="project-table-edit-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.table-shell {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--card-border);
  border-radius: 24px;
  box-shadow: var(--shadow-soft);
}

.project-table {
  width: 100%;
  border-collapse: collapse;
}

.project-table th,
.project-table td {
  padding: 16px 18px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.86);
  text-align: left;
  font-size: 13px;
}

.project-table th {
  color: var(--text-subtle);
  font-weight: 600;
}

.project-table tbody tr {
  cursor: pointer;
  transition: background-color 160ms ease;
}

.project-table tbody tr:hover {
  background: rgba(79, 110, 247, 0.05);
}

.project-table tbody tr:last-child td {
  border-bottom: none;
}

.project-table-actions-col {
  width: 88px;
  white-space: nowrap;
}

.project-table-edit {
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(79, 110, 247, 0.35);
  background: rgba(79, 110, 247, 0.08);
  color: #4f6ef7;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.project-table-edit:hover {
  background: rgba(79, 110, 247, 0.14);
  border-color: rgba(79, 110, 247, 0.55);
}

.project-table-edit-muted {
  color: var(--text-subtle);
  font-size: 12px;
}
</style>

