<template>
  <div class="archive">
    <h1>Архив удалённых данных</h1>

    <div class="filters">
      <button @click="mode = 'user'">Мой архив</button>
      <button @click="mode = 'global'">Административный архив</button>
    </div>

    <div v-if="loading">Загрузка…</div>
    <div v-if="error">Ошибка доступа или загрузки</div>

    <ul v-if="!loading">
      <li v-for="item in items" :key="item.id" class="archive-item" :class="getStatus(getDaysLeft(item.restoreUntil))">
        <strong>{{ item.type }}</strong>
        <div>Удалено: {{ formatDate(item.deletedAt) }}</div>
        <div>Восстановить до: {{ formatDate(item.restoreUntil) }}</div>
      
  <div class="days">
    истекает через {{ getDaysLeft(item.restoreUntil) }} дн.
  </div>
</li>

    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useArchive } from '@/composables/useArchive';
import { auth } from '@/services/firebase';

const { items, loading, error, loadUserArchive, loadGlobalArchive } = useArchive();
const mode = ref<'user' | 'global'>('user');

watch(mode, async () => {
  if (mode.value === 'user') {
    await loadUserArchive(auth.currentUser.uid);
  } else {
    await loadGlobalArchive();
  }
}, { immediate: true });

function formatDate(ts: any) {
  return ts?.toDate ? ts.toDate().toLocaleString() : '';
}

function getStatus(days: number) {
  if (days === 0) return 'danger';
  if (days <= 2) return 'urgent';
  if (days <= 6) return 'warning';
  return 'safe';
}
</script>


<style scoped>
.archive { padding: 16px; }
.filters button { margin-right: 8px; }

.archive-item {
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 8px;
}
.archive-item.safe { border-left: 4px solid #3ba776; }
.archive-item.warning { border-left: 4px solid #f1c40f; }
.archive-item.urgent { border-left: 4px solid #e67e22; }
.archive-item.danger { border-left: 4px solid #e74c3c; }
.days {
  font-size: 12px;
  opacity: 0.8;
}
</style>

