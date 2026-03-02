<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

import { PageScrollWrapper } from '@/ui-core';
import { useDatabase } from '@/composables/useDatabase';
import { useHaptics } from '@/composables/useHaptics';
import { buildDeepSearchBlob, matchesSearchBlob } from '@/utils/searchIndex';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  startAfter,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';

const router = useRouter();
const { impactLight, notificationError, notificationSuccess } = useHaptics();
const { userRole, user, isSuperAdmin, writeAuditLog, listAuditLogs } = useDatabase();

/**
 * STEP 1-4 (Admin Data Audit)
 * - Каталог модулей (read-only)
 * - Просмотр документов (read-only)
 * - Редактирование ТОЛЬКО в безопасных границах (STEP 4)
 * - Подготовка события для audit log (пока local + console)
 */

// ===== UI =====
const btnClass = `
  h-14 bg-white dark:bg-[#1C1C1E] rounded-2xl
  shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]
  dark:shadow-black/50 ring-1 ring-black/5 dark:ring-white/10
  font-bold text-gray-400 dark:text-gray-500
  transition-all duration-300 ease-out transform-gpu no-flicker
  hover:-translate-y-1 hover:text-gray-900 dark:hover:text-white
  hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]
  dark:hover:shadow-black/70 hover:ring-black/10 dark:hover:ring-white/20
  active:translate-y-0 active:shadow-sm
  flex items-center relative z-10 hover:z-20
`;

// ===== Tabs =====
const activeTab = ref('structure'); // structure | logs
const searchQuery = ref('');

const buildSearchBlob = (source) => buildDeepSearchBlob(source, 3, 80);

// ===== Registry (STEP 2) =====
const modulesRegistry = [
  {
    id: 'settings',
    titleHuman: 'Глобальные настройки',
    descriptionHuman: 'Параметры системы: цены, материалы и общие настройки.',
    pathHint: 'Firestore: /settings/*',
    permissionsRequired: ['settings.global.view', 'canViewSettings'],
  },
  {
    id: 'users',
    titleHuman: 'Пользователи',
    descriptionHuman: 'Профили пользователей: отображаемое имя, роль, права.',
    pathHint: 'Firestore: /users/*',
    permissionsRequired: ['users.list.view', 'canManageTeam'],
  },
  {
    id: 'history',
    titleHuman: 'История проектов',
    descriptionHuman: 'История расчётов пользователей (только просмотр по политике).',
    pathHint: 'Firestore: /users/{uid}/history/*',
    permissionsRequired: ['history.view', 'canSaveHistory'],
    readOnly: true,
  },
  {
    id: 'trash',
    titleHuman: 'Архив удалённых данных',
    descriptionHuman: 'Временное хранение удалённых элементов (восстановление/удаление отдельными операциями).',
    pathHint: 'Firestore: /users/{uid}/trash/*',
    permissionsRequired: ['settings.global.view', 'canViewSettings'],
    readOnly: true,
  },
];

// Filter visible modules (Super Admin only)
const visibleModules = computed(() => {
  return modulesRegistry
    .filter((m) => {
      return matchesSearchBlob(buildSearchBlob(m), searchQuery.value);
    });
});

// ===== Selection =====
const selectedModuleId = ref(null);
const selectedModule = computed(() => visibleModules.value.find((m) => m.id === selectedModuleId.value) || null);

const docs = ref([]);
const isLoadingDocs = ref(false);
const loadError = ref('');
const cursor = ref(null);
const hasMore = ref(false);

const selectedDocId = ref(null);
const selectedDoc = ref(null);
const isLoadingDoc = ref(false);

// ===== Edit mode (STEP 4) =====
const isEditing = ref(false);
const editDraft = ref({});
const validationError = ref('');
// ===== Audit logs (STEP 5) =====
const auditLogs = ref([]);
const logsCursor = ref(null);
const logsHasMore = ref(false);
const isLoadingLogs = ref(false);
const logsError = ref('');
const actionFilter = ref('all'); // all | update | restore | delete...
const periodFilter = ref('30'); // all | 1 | 7 | 30 | 90
const selectedLogId = ref(null);

const selectedLog = computed(() => {
  if (!selectedLogId.value) return null;
  return filteredAuditLogs.value.find((x) => x.id === selectedLogId.value) || null;
});

const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;

function logTsMs(l) {
  if (!l) return 0;
  if (typeof l.tsMs === 'number') return l.tsMs;
  const ts = l.ts;
  if (ts?.toMillis) return ts.toMillis();
  return 0;
}

const filteredAuditLogs = computed(() => {
  const now = Date.now();
  const days = periodFilter.value === 'all' ? null : Number(periodFilter.value || 30);
  const since = days ? (now - days * DAY_MS_LOCAL) : null;

  return auditLogs.value
    .filter((l) => {
      if (!since) return true;
      return logTsMs(l) >= since;
    })
    .filter((l) => {
      const blob = buildSearchBlob(l);
      return matchesSearchBlob(blob, searchQuery.value);
    });
});

async function loadAuditLogs({ reset = false } = {}) {
  logsError.value = '';
  isLoadingLogs.value = true;

  try {
    const res = await listAuditLogs({
      pageSize: 40,
      cursorDoc: reset ? null : logsCursor.value,
      action: actionFilter.value === 'all' ? null : actionFilter.value,
    });
    if (reset) auditLogs.value = res.items;
    else auditLogs.value = [...auditLogs.value, ...res.items];
    logsCursor.value = res.cursorDoc;
    logsHasMore.value = !!res.hasMore;
  } catch (e) {
    console.error('[AdminDataAudit] loadAuditLogs error', e);
    logsError.value = 'Не удалось загрузить логи.';
  } finally {
    isLoadingLogs.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'logs' && isSuperAdmin.value) {
    loadAuditLogs({ reset: true });
  }
});

watch(actionFilter, () => {
  if (activeTab.value === 'logs' && isSuperAdmin.value) {
    loadAuditLogs({ reset: true });
  }
});

// ===== Guards =====
onMounted(() => {
  // Access guard: Super Admin only (hard rule)
  if (!isSuperAdmin.value) {
    notificationError('Доступ только для Super Admin');
    router.replace('/settings');
  }
});

// ===== Firestore adapters =====
function moduleCollectionRef(moduleId) {
  if (moduleId === 'settings') return collection(db, 'settings');
  if (moduleId === 'users') return collection(db, 'users');
  // STEP 4 scope: history/trash are read-only and user-scoped – показываем пояснение вместо чтения
  return null;
}

function moduleDocRef(moduleId, docId) {
  if (moduleId === 'settings') return doc(db, 'settings', docId);
  if (moduleId === 'users') return doc(db, 'users', docId);
  return null;
}

// Read docs list (STEP 3)
async function loadDocuments({ reset = false } = {}) {
  loadError.value = '';
  isLoadingDocs.value = true;

  try {
    if (!selectedModule.value) return;

    // History/Trash (user-scoped) – не грузим тут, чтобы не открывать лишние риски на STEP 4
    if (selectedModule.value.id === 'history' || selectedModule.value.id === 'trash') {
      docs.value = [];
      hasMore.value = false;
      cursor.value = null;
      return;
    }

    const colRef = moduleCollectionRef(selectedModule.value.id);
    if (!colRef) {
      docs.value = [];
      hasMore.value = false;
      cursor.value = null;
      return;
    }

    const pageSize = 20;
    const q = reset
      ? query(colRef, orderBy('__name__'), fsLimit(pageSize))
      : (cursor.value
          ? query(colRef, orderBy('__name__'), startAfter(cursor.value), fsLimit(pageSize))
          : query(colRef, orderBy('__name__'), fsLimit(pageSize)));

    const snap = await getDocs(q);
    const batch = snap.docs.map((d) => ({
      id: d.id,
      __ref: d.ref,
      __raw: d.data(),
    }));

    if (reset) docs.value = batch;
    else docs.value = [...docs.value, ...batch];

    cursor.value = snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor.value;
    hasMore.value = snap.docs.length === pageSize;
  } catch (e) {
    console.error('[AdminDataAudit] loadDocuments error', e);
    loadError.value = 'Не удалось загрузить список документов.';
  } finally {
    isLoadingDocs.value = false;
  }
}

// Read one doc (STEP 3)
async function openDocument(docId) {
  selectedDocId.value = docId;
  selectedDoc.value = null;
  isEditing.value = false;
  validationError.value = '';
  isLoadingDoc.value = true;

  try {
    const ref = moduleDocRef(selectedModule.value?.id, docId);
    if (!ref) {
      selectedDoc.value = null;
      return;
    }
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      selectedDoc.value = null;
      return;
    }
    selectedDoc.value = {
      id: snap.id,
      path: snap.ref.path,
      data: snap.data(),
      __ref: snap.ref,
    };
  } catch (e) {
    console.error('[AdminDataAudit] openDocument error', e);
    notificationError('Не удалось открыть документ');
  } finally {
    isLoadingDoc.value = false;
  }
}

// ===== STEP 4 policy =====
function canEditCurrentDoc() {
  if (!selectedDoc.value || !selectedModule.value) return false;

  if (!isSuperAdmin.value) return false;
  if (selectedModule.value.id === 'history' || selectedModule.value.id === 'trash') return false;
  return selectedModule.value.id === 'settings' || selectedModule.value.id === 'users';
}

function editableFieldsForModule(moduleId) {
  if (moduleId === 'settings') return null; // null => primitives only (no deletion)
  if (moduleId === 'users') return ['displayName', 'role'];
  return [];
}

function isPrimitive(v) {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null;
}

function buildEditDraft() {
  if (!selectedDoc.value) return {};
  const data = selectedDoc.value.data || {};
  const allowList = editableFieldsForModule(selectedModule.value.id);

  const out = {};
  Object.keys(data).forEach((k) => {
    const v = data[k];
    if (allowList && Array.isArray(allowList)) {
      if (!allowList.includes(k)) return;
      if (!isPrimitive(v)) return;
      out[k] = v;
      return;
    }

    // settings: allow primitives only
    if (!allowList) {
      if (!isPrimitive(v)) return;
      out[k] = v;
    }
  });

  return out;
}

function startEdit() {
  if (!canEditCurrentDoc()) return;
  isEditing.value = true;
  validationError.value = '';
  editDraft.value = buildEditDraft();
}

function cancelEdit() {
  isEditing.value = false;
  validationError.value = '';
  editDraft.value = {};
}

// ===== Validation (STEP 4) =====
function validateDraft() {
  validationError.value = '';

  if (!selectedDoc.value) {
    validationError.value = 'Документ не выбран.';
    return false;
  }

  const moduleId = selectedModule.value?.id;
  const allowList = editableFieldsForModule(moduleId);

  // users role check
  if (moduleId === 'users' && 'role' in editDraft.value && userRole.value !== 'superadmin') {
    validationError.value = 'Роль может менять только superadmin.';
    return false;
  }

  // types
  for (const [k, v] of Object.entries(editDraft.value || {})) {
    const ok = (typeof v === 'string') || (typeof v === 'number') || (typeof v === 'boolean') || v === null;
    if (!ok) {
      validationError.value = `Поле «${k}» имеет неподдерживаемый тип.`;
      return false;
    }
    if (allowList && Array.isArray(allowList) && !allowList.includes(k)) {
      validationError.value = `Поле «${k}» запрещено для редактирования.`;
      return false;
    }
  }

  return true;
}

// diff helper for audit event
function pickPrimitives(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    const v = obj[k];
    if (isPrimitive(v)) out[k] = v;
  });
  return out;
}

function buildAuditEvent(beforeObj, afterObj) {
  const now = Date.now();
  const actorUid = user.value?.uid || null;
  const actorEmail = user.value?.email || null;
  const actorRole = userRole.value || null;

  return {
    ts: now,
    action: 'update',
    actorUid,
    actorEmail,
    actorRole,
    entityType: selectedModule.value?.id || null,
    entityId: selectedDoc.value?.id || null,
    entityPath: selectedDoc.value?.path || null,
    before: pickPrimitives(beforeObj),
    after: pickPrimitives(afterObj),
    source: 'ui',
  };
}

// Save (STEP 4)
async function saveEdit() {
  if (!validateDraft()) {
    notificationError(validationError.value || 'Ошибка валидации');
    return;
  }
  if (!canEditCurrentDoc()) {
    notificationError('Запрещено политикой доступа');
    return;
  }

  const before = { ...(selectedDoc.value?.data || {}) };
  const after = { ...before, ...(editDraft.value || {}) };

  // Compute patch: only changed primitives
  const patch = {};
  for (const [k, v] of Object.entries(editDraft.value || {})) {
    if (before[k] !== v) patch[k] = v;
  }

  if (!Object.keys(patch).length) {
    notificationSuccess('Нет изменений');
    isEditing.value = false;
    return;
  }

  try {
    await updateDoc(selectedDoc.value.__ref, patch);

    // Update local state
    selectedDoc.value.data = after;
    isEditing.value = false;

    // STEP 5: пишем audit log в Firestore (Super Admin only)
    const evt = buildAuditEvent(before, after);
    try {
      await writeAuditLog(evt);
    } catch (e) {
      console.warn('[AuditLog] write failed', e);
    }

    // локальное отражение (быстрый UX) + фильтрация по вкладке "Логи"
    auditLogs.value = [{ ...evt, tsMs: Date.now() }, ...auditLogs.value].slice(0, 200);

    notificationSuccess('Сохранено');
  } catch (e) {
    console.error('[AdminDataAudit] saveEdit error', e);
    notificationError('Не удалось сохранить');
  }
}

// ===== Reactive flows =====
watch(selectedModuleId, async () => {
  // reset state on module change
  docs.value = [];
  cursor.value = null;
  hasMore.value = false;
  selectedDocId.value = null;
  selectedDoc.value = null;
  isEditing.value = false;
  validationError.value = '';
  editDraft.value = {};

  if (selectedModuleId.value) await loadDocuments({ reset: true });
});

const emptyStateText = computed(() => {
  if (activeTab.value === 'logs') return 'Логи пока не загружены';
  if (!selectedModule.value) return 'Выберите модуль данных';
  if ((selectedModule.value.id === 'history' || selectedModule.value.id === 'trash')) {
    return 'Этот модуль зависит от пользователя и на STEP 4 доступен только как карта структуры.';
  }
  return 'Нет данных для отображения';
});

const goBack = () => { impactLight(); router.push('/settings'); };
</script>

<template>
  <div class="h-screen w-full bg-[#F5F5F7] dark:bg-[#121212] overflow-hidden flex flex-col relative transition-colors duration-500">
    <PageScrollWrapper class="flex-1">
      <div class="pb-32 pt-2 relative min-h-full flex flex-col w-full pt-6">
        <div class="max-w-5xl mx-auto px-5 w-full relative z-10">

          <!-- Header -->
          <div class="flex items-center justify-center relative mb-8 animate-fade-in-down">
            <h1 class="text-3xl md:text-5xl font-black text-[#1d1d1f] dark:text-white tracking-tighter leading-none text-center px-6 py-2 transition-colors duration-300">
              Структура данных
            </h1>
          </div>

          <div class="relative flex flex-col sm:flex-row gap-4 w-full mb-8 animate-fade-in-up z-40 items-center">
            <button @click="goBack" :class="[btnClass, 'px-6 justify-center gap-2 shrink-0 w-full sm:w-auto']">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              <span class="font-bold text-sm">Назад</span>
            </button>

            <div class="relative flex-1 group w-full" :class="btnClass">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="text-inherit transition-colors duration-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                v-model="searchQuery"
                class="block w-full h-full pl-12 pr-12 bg-transparent rounded-2xl text-sm font-bold outline-none text-inherit placeholder-gray-400/70 transition-colors cursor-text"
                placeholder="Поиск по модулям..."
              >
              <button v-if="searchQuery" @click="searchQuery=''" class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-black dark:hover:text-white cursor-pointer z-10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Tabs -->
            <div class="flex gap-2 w-full sm:w-auto">
              <button
                @click="activeTab='structure'"
                :class="[btnClass, 'px-5 justify-center w-full sm:w-auto', activeTab==='structure' ? 'text-gray-900 dark:text-white' : '']"
              >
                Структура
              </button>
              <button
                @click="activeTab='logs'"
                :class="[btnClass, 'px-5 justify-center w-full sm:w-auto', activeTab==='logs' ? 'text-gray-900 dark:text-white' : '']"
              >
                Логи
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="space-y-8 animate-fade-in-up" style="animation-delay: 0.1s;">

            <!-- Audit Logs (STEP 5) -->
            <div v-if="activeTab==='logs'" class="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
              <div class="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
                <div class="text-sm font-bold text-gray-500 dark:text-gray-400">
                  Audit Logs — фиксируем каждое действие Super Admin
                </div>

                <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <select v-model="actionFilter" class="h-12 px-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 outline-none transition-all duration-300 ease-out transform-gpu hover:-translate-y-1 hover:ring-black/10 dark:hover:ring-white/20 hover:shadow-[0_10px_18px_-10px_rgba(0,0,0,0.25)] dark:hover:shadow-black/40">
                    <option value="all">Все действия</option>
                    <option value="update">Изменения</option>
                    <option value="restore">Восстановления</option>
                    <option value="delete">Удаления</option>
                  </select>
                  <select v-model="periodFilter" class="h-12 px-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10 text-sm font-bold text-gray-700 dark:text-gray-200 outline-none transition-all duration-300 ease-out transform-gpu hover:-translate-y-1 hover:ring-black/10 dark:hover:ring-white/20 hover:shadow-[0_10px_18px_-10px_rgba(0,0,0,0.25)] dark:hover:shadow-black/40">
                    <option value="all">За всё время</option>
                    <option value="1">24 часа</option>
                    <option value="7">7 дней</option>
                    <option value="30">30 дней</option>
                    <option value="90">90 дней</option>
                  </select>
                  <button @click="loadAuditLogs({ reset: true })" :class="[btnClass, 'px-6 justify-center gap-2 h-12 w-full sm:w-auto']">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                      <path d="M21 3v6h-6"></path>
                    </svg>
                    <span class="font-bold text-sm">Обновить</span>
                  </button>
                </div>
              </div>

              <div v-if="logsError" class="text-sm font-bold text-red-600 mb-3">{{ logsError }}</div>
              <div v-if="isLoadingLogs" class="text-sm font-bold text-gray-500 dark:text-gray-400">Загрузка логов...</div>

              <div v-else-if="!filteredAuditLogs.length" class="text-center py-10">
                <div class="text-lg font-black text-[#1d1d1f] dark:text-white mb-2">Логи не найдены</div>
                <div class="text-sm font-bold text-gray-500 dark:text-gray-400">Попробуй изменить фильтры или строку поиска.</div>
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  v-for="l in filteredAuditLogs"
                  :key="l.id"
                  @click="selectedLogId = l.id"
                  class="text-left rounded-3xl p-5 bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div class="text-sm font-black text-[#1d1d1f] dark:text-white">
                    {{ (l.actorEmail || 'Super Admin') }}
                  </div>
                  <div class="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                    {{ l.action }} • {{ l.entityType }}/{{ l.entityId }}
                  </div>
                  <div class="text-xs font-bold text-gray-400 dark:text-gray-500 mt-2">
                    {{ new Date(logTsMs(l) || Date.now()).toLocaleString() }}
                  </div>
                </button>
              </div>

              <div v-if="logsHasMore" class="mt-6">
                <button @click="loadAuditLogs({ reset: false })" :class="[btnClass, 'px-6 justify-center gap-2 w-full']">
                  Показать ещё
                </button>
              </div>

              <!-- Detail view -->
              <div v-if="selectedLog" class="mt-8 rounded-3xl p-6 bg-white dark:bg-[#1C1C1E] ring-1 ring-black/5 dark:ring-white/10">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-lg font-black text-[#1d1d1f] dark:text-white">Детали события</div>
                    <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                      {{ (selectedLog.actorEmail || 'Super Admin') }} • {{ selectedLog.action }}
                    </div>
                  </div>
                  <button @click="selectedLogId=null" class="text-gray-400 hover:text-black dark:hover:text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div class="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="rounded-2xl p-4 bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10">
                    <div class="text-xs font-black text-gray-600 dark:text-gray-300 mb-2">До</div>
                    <pre class="text-xs font-mono whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">{{ JSON.stringify(selectedLog.before || {}, null, 2) }}</pre>
                  </div>
                  <div class="rounded-2xl p-4 bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10">
                    <div class="text-xs font-black text-gray-600 dark:text-gray-300 mb-2">После</div>
                    <pre class="text-xs font-mono whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">{{ JSON.stringify(selectedLog.after || {}, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>

            <!-- Structure -->
            <template v-else>
              <!-- Module cards -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  v-for="m in visibleModules"
                  :key="m.id"
                  @click="selectedModuleId = m.id"
                  class="text-left bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div class="text-xl font-black text-[#1d1d1f] dark:text-white leading-tight">
                    {{ m.titleHuman }}
                  </div>
                  <div class="mt-2 text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
                    {{ m.descriptionHuman }}
                  </div>
                  <div class="mt-3 text-xs font-bold text-gray-400 dark:text-gray-500">
                    {{ m.pathHint }}
                  </div>
                </button>
              </div>

              <!-- Module detail panel -->
              <div v-if="selectedModule" class="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div class="text-2xl font-black text-[#1d1d1f] dark:text-white">{{ selectedModule.titleHuman }}</div>
                    <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">{{ selectedModule.pathHint }}</div>
                  </div>

                  <button
                    v-if="selectedModule.id==='settings' || selectedModule.id==='users'"
                    @click="loadDocuments({ reset: true })"
                    :class="[btnClass, 'px-6 justify-center gap-2 w-full md:w-auto']"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                      <path d="M21 3v6h-6"></path>
                    </svg>
                    <span class="font-bold text-sm">Обновить</span>
                  </button>
                </div>

                <div class="mt-6">
                  <div v-if="loadError" class="text-sm font-bold text-red-600">{{ loadError }}</div>

                  <div v-if="(selectedModule.id==='history' || selectedModule.id==='trash')" class="text-center py-10">
                    <div class="text-lg font-black text-[#1d1d1f] dark:text-white mb-2">{{ emptyStateText }}</div>
                    <div class="text-sm font-bold text-gray-500 dark:text-gray-400">
                      На следующем шаге можно добавить выбор пользователя и безопасное чтение.
                    </div>
                  </div>

                  <div v-else>
                    <div v-if="isLoadingDocs" class="text-sm font-bold text-gray-500 dark:text-gray-400">Загрузка...</div>

                    <div v-else-if="!docs.length" class="text-center py-10">
                      <div class="text-lg font-black text-[#1d1d1f] dark:text-white mb-2">{{ emptyStateText }}</div>
                    </div>

                    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <button
                        v-for="d in docs"
                        :key="d.id"
                        @click="openDocument(d.id)"
                        class="text-left rounded-3xl p-5 bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                      >
                        <div class="text-base font-black text-[#1d1d1f] dark:text-white truncate">{{ d.id }}</div>
                        <div class="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400 truncate">
                          {{ selectedModule.id==='users' ? 'Профиль пользователя' : 'Документ настроек' }}
                        </div>
                      </button>
                    </div>

                    <div class="mt-5" v-if="hasMore">
                      <button @click="loadDocuments()" :class="[btnClass, 'px-6 justify-center w-full md:w-auto']">
                        Загрузить ещё
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Document viewer -->
              <div v-if="selectedDocId" class="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div class="text-2xl font-black text-[#1d1d1f] dark:text-white">{{ selectedDocId }}</div>
                    <div class="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1" v-if="selectedDoc?.path">
                      {{ selectedDoc.path }}
                    </div>
                  </div>

                  <div class="flex gap-2">
                    <button
                      v-if="!isEditing && canEditCurrentDoc()"
                      @click="startEdit"
                      :class="[btnClass, 'px-6 justify-center w-full md:w-auto']"
                    >
                      Редактировать
                    </button>

                    <button
                      v-if="isEditing"
                      @click="saveEdit"
                      :class="[btnClass, 'px-6 justify-center w-full md:w-auto text-gray-900 dark:text-white']"
                    >
                      Сохранить
                    </button>

                    <button
                      v-if="isEditing"
                      @click="cancelEdit"
                      :class="[btnClass, 'px-6 justify-center w-full md:w-auto']"
                    >
                      Отмена
                    </button>
                  </div>
                </div>

                <div class="mt-6">
                  <div v-if="isLoadingDoc" class="text-sm font-bold text-gray-500 dark:text-gray-400">Загрузка...</div>

                  <div v-else-if="!selectedDoc" class="text-sm font-bold text-gray-500 dark:text-gray-400">
                    Документ не найден.
                  </div>

                  <template v-else>
                    <div v-if="validationError" class="text-sm font-bold text-red-600 mb-4">
                      {{ validationError }}
                    </div>

                    <!-- Edit form (primitives only) -->
                    <div v-if="isEditing" class="space-y-4">
                      <div class="text-sm font-bold text-gray-500 dark:text-gray-400">
                        Доступны только безопасные поля (строка/число/булево). Сложные структуры на STEP 4 не редактируются.
                      </div>

                      <div
                        v-for="(v, k) in editDraft"
                        :key="k"
                        class="rounded-2xl p-4 bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10"
                      >
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{{ k }}</div>

                        <input
                          v-if="typeof v === 'string' || v === null"
                          v-model="editDraft[k]"
                          class="w-full bg-white/70 dark:bg-white/5 rounded-2xl px-4 py-3 font-bold text-sm text-[#1d1d1f] dark:text-white outline-none ring-1 ring-black/5 dark:ring-white/10"
                          placeholder="Значение..."
                        />

                        <input
                          v-else-if="typeof v === 'number'"
                          type="number"
                          v-model.number="editDraft[k]"
                          class="w-full bg-white/70 dark:bg-white/5 rounded-2xl px-4 py-3 font-bold text-sm text-[#1d1d1f] dark:text-white outline-none ring-1 ring-black/5 dark:ring-white/10"
                        />

                        <label v-else-if="typeof v === 'boolean'" class="flex items-center gap-3">
                          <input type="checkbox" v-model="editDraft[k]" class="w-5 h-5 rounded" />
                          <span class="text-sm font-bold text-[#1d1d1f] dark:text-white">
                            {{ editDraft[k] ? 'Включено' : 'Выключено' }}
                          </span>
                        </label>

                        <div v-else class="text-sm font-bold text-gray-500 dark:text-gray-400">Недоступно для редактирования</div>
                      </div>
                    </div>

                    <!-- Read-only view -->
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        v-for="(v, k) in selectedDoc.data"
                        :key="k"
                        class="rounded-2xl p-4 bg-[#F5F5F7] dark:bg-[#121212] ring-1 ring-black/5 dark:ring-white/10"
                      >
                        <div class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{{ k }}</div>
                        <div class="text-sm font-bold text-[#1d1d1f] dark:text-white break-words">
                          <template v-if="typeof v === 'string'">{{ v }}</template>
                          <template v-else-if="typeof v === 'number'">{{ v }}</template>
                          <template v-else-if="typeof v === 'boolean'">{{ v ? 'Да' : 'Нет' }}</template>
                          <template v-else-if="v === null">—</template>
                          <template v-else>
                            <details class="cursor-pointer">
                              <summary class="text-sm font-black text-gray-600 dark:text-gray-300">Показать JSON</summary>
                              <pre class="mt-3 text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-200">{{ JSON.stringify(v, null, 2) }}</pre>
                            </details>
                          </template>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

            </template>
          </div>
        </div>
      </div>
    </PageScrollWrapper>
  </div>
</template>
