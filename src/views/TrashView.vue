<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { PageScrollWrapper } from '@/ui-core'
import ModernSelect from '@/components/ModernSelect.vue'

import { useDatabase } from '@/composables/useDatabase'
import { useHaptics } from '@/composables/useHaptics'
import { buildDeepSearchBlob, matchesSearchBlob } from '@/utils/searchIndex'

const router = useRouter()
const { impactLight, impactMedium, notificationSuccess, notificationError } = useHaptics()

const {
  hasPermission,
  getCloudTrash,
  restoreCloudHistoryFromTrash,
} = useDatabase()
// ===== UI =====
const btnClass = `
  h-14 
  bg-white dark:bg-[#1C1C1E] 
  rounded-2xl 
  shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] 
  dark:shadow-black/50 
  ring-1 ring-black/5 dark:ring-white/10 
  font-bold text-gray-400 dark:text-gray-500
  transition-all duration-300 ease-out 
  transform-gpu no-flicker
  hover:-translate-y-1 
  hover:text-gray-900 dark:hover:text-white
  hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]
  dark:hover:shadow-black/70
  hover:ring-black/10 dark:hover:ring-white/20
  active:translate-y-0 active:shadow-sm
  flex items-center relative z-10 hover:z-20
`

const actionBtnClass = `
  bg-[#1d1d1f] dark:bg-white 
  text-white dark:text-black 
  px-5 py-3 
  rounded-full 
  font-bold text-xs uppercase tracking-widest 
  shadow-xl shadow-black/20 
  transition-all duration-300 ease-out 
  transform-gpu
  hover:-translate-y-1 
  hover:shadow-2xl hover:shadow-black/40 
  active:translate-y-0 active:shadow-xl
`
 


// ===== PERMISSIONS =====
const canSeeDeletedSettings = computed(() =>
  hasPermission('canEditGlobalSettings')
)

// ===== STATE =====
const isLoading = ref(true)
const error = ref(null)
const trashItems = ref([])

const searchQuery = ref('')
// Пустое значение = «не выбран фильтр» (placeholder остаётся видимым)
const activeDataType = ref('')
const activePeriod = ref('')

// ===== OPTIONS (СТАТИЧНЫЕ, БЕЗ computed) =====
const dataTypeOptions = [
  { id: 'projects', label: 'Проекты' },
  { id: 'calculators', label: 'Калькуляторы' },
  { id: 'settings', label: 'Настройки' },
  { id: 'estimates', label: 'Сметы' },
]

const periodOptions = [
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: 'Последние 7 дней' },
  { id: '30d', label: 'Последние 30 дней' },
]

// ===== HELPERS =====
function normalizeTrashItem(raw) {
  return {
    ...raw,
    itemType: raw?.itemType || 'projects',
  }
}

function buildSearchBlob(item) {
  return buildDeepSearchBlob({
    title: itemTitle(item),
    typeLabel: itemTypeLabel(item),
    dataType: item?.dataType,
    deletedAt: formatDeletedAt(item),
    total: item?.total,
    dataTotal: item?.data?.total,
    projectClient: item?.state?.project?.client,
    projectName: item?.state?.project?.name,
    payload: item?.payload,
    state: item?.state,
    data: item?.data,
  }, 3, 60)
}

function prettyJson(item) {
  try {
    return JSON.stringify(item, null, 2)
  } catch {
    return String(item)
  }
}

// ===== EMPTY STATE =====
const emptyStateText = computed(() => {
  if (!trashItems.value.length) {
    return 'Удалённых данных нет'
  }
  return 'По выбранным фильтрам данные не найдены'
})

// ===== FILTERING =====
const filteredItems = computed(() => {
  const now = Date.now()

  const matchesPeriod = (item) => {
    if (!activePeriod.value) return true
    const ms = new Date(item.deletedAtISO || item.savedAt).getTime()
    if (!ms) return false
    if (activePeriod.value === 'today') {
      return new Date(ms).toDateString() === new Date(now).toDateString()
    }
    if (activePeriod.value === '7d') return ms >= now - 7 * 86400000
    if (activePeriod.value === '30d') return ms >= now - 30 * 86400000
    return true
  }

  return trashItems.value.filter((item) => {
    if (activeDataType.value && item.itemType !== activeDataType.value) {
      return false
    }
    if (!matchesPeriod(item)) return false
    return matchesSearchBlob(buildSearchBlob(item), searchQuery.value)
  })
})

// ===== API =====
const loadTrash = async () => {
  isLoading.value = true
  error.value = null
  try {
    const data = await getCloudTrash()
    trashItems.value = Array.isArray(data)
      ? data.map(normalizeTrashItem)
      : []
  } catch (e) {
    error.value = e?.message || 'Ошибка загрузки'
    trashItems.value = []
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  impactLight()
  router.push('/settings')
}


const getPurgeMs = (item) => {
  // Supports multiple schemas: purgeAt (Timestamp), restoreUntil (Timestamp), expiresAtISO (string)
  const ts = item?.purgeAt || item?.restoreUntil
  if (ts?.toDate) return ts.toDate().getTime()
  const iso = item?.expiresAtISO || item?.purgeAtISO || item?.restoreUntilISO
  if (iso) {
    const ms = new Date(iso).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  // fallback: deletedAt + 30d
  const delIso = item?.deletedAtISO
  const delMs = delIso ? new Date(delIso).getTime() : 0
  return delMs ? delMs + 30 * 86400000 : 0
}

const getDeletedMs = (item) => {
  const ts = item?.deletedAt
  if (ts?.toDate) return ts.toDate().getTime()
  const iso = item?.deletedAtISO || item?.savedAt
  if (!iso) return 0
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : 0
}

const calcDaysLeft = (item) => {
  const end = getPurgeMs(item)
  if (!end) return 0
  const now = Date.now()
  return Math.max(0, Math.ceil((end - now) / 86400000))
}

const isExpired = (item) => {
  const end = getPurgeMs(item)
  return end ? end <= Date.now() : false
}

const canRestore = (item) => {
  if (!item) return false
  if (isExpired(item)) return false

  // settings restore is privileged
  if (item.itemType === 'settings' || item.type === 'settings') {
    return hasPermission('canEditGlobalSettings')
  }

  // history/projects restore — same gate as history write
  return hasPermission('canSaveHistory') || hasPermission('history.write')
}

// ===== DESTINATION MODAL (Step 6 / Modal #2) =====
const destModal = ref({
  open: false,
  title: '',
  text: '',
  options: [],
  selected: null,
  item: null,
  locked: false,
})

const closeDestModal = () => {
  destModal.value.open = false
  destModal.value.item = null
  destModal.value.options = []
  destModal.value.selected = null
  destModal.value.locked = false
}

const openDestModal = ({ item, title, text, options }) => {
  destModal.value = {
    open: true,
    title,
    text,
    options,
    selected: options?.[0]?.id ?? null,
    item,
    locked: false,
  }
}

const needsDestination = (item) => {
  // Для текущих типов (history/projects/settings) назначения не требуется.
  // Хук оставлен на будущее расширение (README Step 6).
  return Array.isArray(item?.destinations) && item.destinations.length > 0
}

const performRestore = async (item, destination = null) => {
  const res = await restoreCloudHistoryFromTrash(item.id, { destination })
  if (res?.status === 'success') {
    notificationSuccess?.(res?.message || 'Восстановлено')
    await loadTrash()
  } else {
    throw new Error(res?.message || 'Ошибка восстановления')
  }
}

const restoreItem = async (item) => {
  if (!canRestore(item)) {
    notificationError?.('Нет прав или срок хранения истёк')
    return
  }

  const delMs = getDeletedMs(item)
  const delStr = delMs ? new Date(delMs).toLocaleString() : '—'
  const dleft = calcDaysLeft(item)

  impactMedium()

  openModal({
    title: 'Подтверждение восстановления',
    text: 'Вы собираетесь восстановить удалённые данные. После восстановления запись исчезнет из архива.',
    details: [
      `Что: ${itemTitle(item)}`,
      `Модуль: ${(item?.type || item?.itemType || '—')}`,
      `Удалено: ${delStr}`,
      `Осталось: ${dleft} дн.`,
    ],
    confirmText: 'ПРОДОЛЖИТЬ',
    confirmKind: 'ok',
    lockMs: 900,
    action: async () => {
      // Modal #2 — если потребуется назначение
      if (needsDestination(item)) {
        openDestModal({
          item,
          title: 'Куда восстановить',
          text: 'Выберите назначение восстановления. Недоступные варианты скрыты правами доступа.',
          options: item.destinations,
        })
        return
      }
      await performRestore(item)
    },
  })
}



// ===== TOAST (fallback, always visible) =====
const toast = ref(null)
let toastTimer = null
const showToast = (message, type = 'info') => {
  toast.value = { message, type, ts: Date.now() }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 2600)
}

// ===== CONFIRM MODAL =====
const modal = ref({
  open: false,
  title: '',
  text: '',
  details: [],
  confirmText: '',
  confirmKind: 'ok', // ok | danger
  locked: false,
  action: null,
})

const closeModal = () => {
  modal.value.open = false
  modal.value.locked = false
  modal.value.action = null
}

const openModal = ({ title, text, details = [], confirmText, confirmKind = 'ok', lockMs = 0, action }) => {
  modal.value = { open: true, title, text, details, confirmText, confirmKind, locked: lockMs > 0, action }
  if (lockMs > 0) {
    setTimeout(() => {
      if (modal.value.open) modal.value.locked = false
    }, lockMs)
  }
}

const confirmModal = async () => {
  if (modal.value.locked) return
  try {
    await modal.value.action?.()
  } finally {
    closeModal()
  }
}

// ===== GROUPING (default view) =====
const typeLabels = {
  history: 'История',
  projects: 'Проекты',
  calculators: 'Калькуляторы',
  settings: 'Настройки',
  estimates: 'Сметы',
  users: 'Пользователи',
}

const openedGroups = ref({
  history: true,
  projects: true,
  calculators: true,
  settings: true,
  estimates: true,
  users: true,
  other: true,
})

const groupedItems = computed(() => {
  const groups = {
    history: [],
    projects: [],
    calculators: [],
    settings: [],
    estimates: [],
    users: [],
    other: [],
  }
  for (const x of filteredItems.value) {
    const k = (x?.itemType || x?.type || 'other')
    if (groups[k]) groups[k].push(x)
    else groups.other.push(x)
  }
  return groups
})

const isDefaultBrowseMode = computed(() =>
  !searchQuery.value && !activeDataType.value && !activePeriod.value
)

// ===== HUMAN SUMMARY (UI) =====
const settingsDataTypeLabel = (key) => {
  const map = {
    materials: 'Материалы',
    coatings: 'Покрытия',
    processing: 'Пост-обработка',
    accessories: 'Аксессуары',
    packaging: 'Упаковка',
    design: 'Дизайн',
    settings: 'Параметры',
  }
  return map[key] || (key ? String(key) : 'Настройки')
}

const pickTotal = (item) => {
  const candidates = [
    item?.total,
    item?.data?.total,
    item?.state?.project?.total,
    item?.state?.totals?.total,
  ]
  for (const x of candidates) {
    const n = typeof x === 'string' ? Number(x) : x
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n
  }
  return 0
}

const fmtMoney = (n) => {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v <= 0) return ''
  return `${Math.round(v).toLocaleString('ru-RU')} ₽`
}

const collectNames = (arr) => {
  if (!Array.isArray(arr)) return []
  const keys = ['name', 'title', 'materialName', 'material', 'label']
  const out = []
  for (const x of arr) {
    if (!x) continue
    if (typeof x === 'string') out.push(x)
    else if (typeof x === 'object') {
      for (const k of keys) {
        if (x?.[k]) {
          out.push(String(x[k]))
          break
        }
      }
    }
    if (out.length >= 6) break
  }
  return Array.from(new Set(out.map((s) => String(s).trim()).filter(Boolean)))
}

const describeItem = (item) => {
  const t = item?.itemType || item?.type

  // Settings (удалённые элементы настроек)
  if (t === 'settings') {
    const section = settingsDataTypeLabel(item?.dataType)
    const title = itemTitle(item)
    const lines = [
      `Раздел: ${section}`,
      `Источник: Глобальные настройки`,
    ]
    if (title && title !== '—') lines.unshift(`Элемент: ${title}`)
    return {
      subtitle: 'Настройки проекта (временное хранение после удаления)',
      lines,
    }
  }

  // Projects (история/проекты)
  if (t === 'projects' || t === 'history') {
    const total = pickTotal(item)
    const client = item?.state?.project?.client || item?.client
    const layers = collectNames(item?.state?.layers)
    const proc = collectNames(item?.state?.processing)
    const lines = []
    if (total) lines.push(`Сумма: ${fmtMoney(total)}`)
    if (client) lines.push(`Клиент: ${client}`)
    if (layers.length) lines.push(`Материалы/слои: ${layers.join(', ')}`)
    if (proc.length) lines.push(`Работы: ${proc.join(', ')}`)
    return {
      subtitle: 'Проект со сметой и параметрами расчёта',
      lines,
    }
  }

  // Calculators / Estimates (на будущее, но уже красиво)
  if (t === 'calculators') {
    return {
      subtitle: 'Калькулятор или модуль расчёта',
      lines: [`Название: ${itemTitle(item)}`].filter(Boolean),
    }
  }

  if (t === 'estimates') {
    const total = pickTotal(item)
    const lines = []
    if (total) lines.push(`Сумма: ${fmtMoney(total)}`)
    return {
      subtitle: 'Смета / расчёт',
      lines,
    }
  }

  return {
    subtitle: 'Удалённые данные (временное хранение)',
    lines: [],
  }
}

const daysLeft = (item) => calcDaysLeft(item)

const statusClass = (n) => {
  if (n === 0) return 'danger'
  if (n <= 2) return 'urgent'
  if (n <= 6) return 'warning'
  return 'safe'
}

const itemTitle = (item) => {
  // Главное — название. Если нет, ставим прочерк.
  return (
    item?.name ||
    item?.title ||
    item?.data?.name ||
    item?.data?.title ||
    item?.data?.projectName ||
    item?.data?.projectTitle ||
    item?.data?.calculatorName ||
    item?.data?.scope ||
    '—'
  )
}

const itemTypeLabel = (item) => {
  const t = item?.itemType || item?.type
  const map = {
    settings: 'НАСТРОЙКИ',
    projects: 'ПРОЕКТ',
    calculators: 'КАЛЬКУЛЯТОР',
    estimates: 'СМЕТА',
    history: 'ИСТОРИЯ',
    users: 'ПОЛЬЗОВАТЕЛЬ',
  }
  return (map[t] || String(t || 'ДАННЫЕ')).toUpperCase()
}

const formatDeletedAt = (item) => {
  const ms = getDeletedMs(item)
  if (!ms) return '—'
  // формат ближе к "Истории": DD.MM.YYYY · HH:MM
  const d = new Date(ms)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy} · ${hh}:${min}`
}


onMounted(loadTrash)
</script>

<template>
  <div class="h-screen w-full bg-[#F5F5F7] dark:bg-[#121212] overflow-hidden flex flex-col transition-colors duration-500">
    <PageScrollWrapper class="flex-1">
      <div class="pb-32 pt-6 min-h-full flex flex-col w-full">
        <div class="max-w-5xl mx-auto px-5 w-full">

          
          <!-- HEADER (как в Истории) -->
          <div class="mb-6">
            <h1 class="text-center text-3xl md:text-5xl font-black text-[#1d1d1f] dark:text-white tracking-tight">
              Архив удалённых данных
            </h1>
            <p class="text-center mt-2 text-sm text-gray-500 dark:text-gray-400 font-semibold opacity-80">
              Здесь временно хранятся удалённые данные. Данные хранятся 30 дней и автоматически очищаются.
            </p>
          </div>

          <!-- TOOLBAR (Назад • Поиск • Фильтры) -->
          <div class="relative flex flex-col sm:flex-row gap-4 w-full mb-6 z-40 items-center">
            <button @click="goBack" :class="[btnClass, 'px-6 justify-center gap-2 shrink-0 w-full sm:w-auto']">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              <span class="font-bold text-sm">Меню</span>
            </button>

            <div class="relative flex-1 group w-full" :class="btnClass">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="text-inherit transition-colors duration-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input
                v-model="searchQuery"
                class="block w-full h-full pl-12 pr-12 bg-transparent rounded-2xl text-sm font-bold outline-none text-inherit placeholder-gray-400/70 transition-colors cursor-text"
                placeholder="Поиск по названию, сумме, материалам, дате…"
              >
              <button v-if="searchQuery" @click="searchQuery=''" class="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-black dark:hover:text-white cursor-pointer z-10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <ModernSelect
              v-model="activeDataType"
              :options="dataTypeOptions"
              :class="btnClass"
              class="sm:w-auto w-full px-0"
              placeholder="Тип данных"
            />

            <ModernSelect
              v-model="activePeriod"
              :options="periodOptions"
              :class="btnClass"
              class="sm:w-auto w-full px-0"
              placeholder="Период удаления"
            />
          </div>

          <!-- CONTENT -->

          <div v-if="isLoading" class="text-center py-16 text-gray-400 font-bold">
            Загрузка…
          </div>

          <div v-else-if="error" class="text-center py-16 text-red-500 font-bold">
            {{ error }}
          </div>

          <div v-else-if="!filteredItems.length" class="text-center py-16 text-gray-400 font-bold">
            {{ emptyStateText }}
          </div>

          <!-- DEFAULT BROWSE: grouped -->
          <div v-else-if="isDefaultBrowseMode" class="space-y-3">
            <div v-for="(list, key) in groupedItems" :key="key" class="rounded-3xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 overflow-hidden">
              <button
                class="w-full px-5 py-4 flex items-center gap-3 text-left"
                @click="openedGroups[key] = !openedGroups[key]"
              >
                <div class="font-black text-[#1d1d1f] dark:text-white text-lg flex-1">
                  {{ typeLabels[key] || 'Другое' }}
                </div>
                <div class="text-xs font-extrabold px-3 py-1 rounded-full bg-black/5 dark:bg-white/10">
                  {{ list.length }}
                </div>
                <div class="opacity-70 font-black">
                  {{ openedGroups[key] ? '▾' : '▸' }}
                </div>
              </button>

              <div v-if="openedGroups[key]" class="p-4 grid grid-cols-1 gap-4">
                <div
                  v-for="item in list"
                  :key="item.id"
                  class="p-5 rounded-3xl bg-white dark:bg-[#1C1C1E] shadow-[0_10px_30px_-15px_rgba(0,0,0,0.35)] border border-black/5 dark:border-white/10"
                  :class="statusClass(daysLeft(item))"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex flex-col gap-2 min-w-0">
                      <div class="flex items-center justify-between gap-3">
                        <span class="px-3 py-1 rounded-xl text-[11px] font-extrabold tracking-widest uppercase
                                     bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-200">
                          {{ itemTypeLabel(item) }}
                        </span>
                        <span class="text-xs font-extrabold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          ⏳ Осталось {{ daysLeft(item) }} дн.
                        </span>
                      </div>

                      <div class="text-lg font-black text-[#1d1d1f] dark:text-white truncate">
                        {{ itemTitle(item) }}
                      </div>

                      <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                        🗓 Удалено: {{ formatDeletedAt(item) }}
                      </div>

                      <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold opacity-90">
                        {{ describeItem(item).subtitle }}
                      </div>

                      <div v-if="describeItem(item).lines?.length" class="mt-1 space-y-1">
                        <div v-for="l in describeItem(item).lines" :key="l" class="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                          {{ l }}
                        </div>
                      </div>
                    </div>

                    <div class="flex flex-col gap-2 shrink-0">
                      <button :class="actionBtnClass" @click="restoreItem(item)">
                        ВОССТАНОВИТЬ
                      </button>
                    </div>
                  </div>

                  <details class="mt-4">
                    <summary class="cursor-pointer font-bold text-sm text-gray-600 dark:text-gray-300">
                      Технические детали
                    </summary>
                    <pre class="mt-3 text-xs bg-black/5 dark:bg-white/5 rounded-2xl p-4 max-h-64 overflow-auto">{{ prettyJson(item) }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>

          <!-- FILTERED LIST (existing) -->
          <div v-else class="grid grid-cols-1 gap-4">
            
            <div
              v-for="item in filteredItems"
              :key="item.id"
              class="p-5 pb-16 rounded-3xl bg-white dark:bg-[#1C1C1E]
                     shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] border border-black/5 dark:border-white/10
                     relative overflow-hidden"
              :class="statusClass(daysLeft(item))"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex flex-col gap-2 min-w-0">
                  <div class="flex items-center justify-between gap-3">
                    <span class="px-3 py-1 rounded-xl text-[11px] font-extrabold tracking-widest uppercase
                                 bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-200">
                      {{ itemTypeLabel(item) }}
                    </span>
                    <span class="text-xs font-extrabold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      ⏳ Осталось {{ daysLeft(item) }} дн.
                    </span>
                  </div>

                  <div class="text-lg font-black text-[#1d1d1f] dark:text-white truncate">
                    {{ itemTitle(item) }}
                  </div>

                  <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                    🗓 Удалено: {{ formatDeletedAt(item) }}
                  </div>

                  <div class="text-xs text-gray-500 dark:text-gray-400 font-semibold opacity-90">
                    {{ describeItem(item).subtitle }}
                  </div>

                  <div v-if="describeItem(item).lines?.length" class="mt-1 space-y-1">
                    <div v-for="l in describeItem(item).lines" :key="l" class="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                      {{ l }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="h-px w-full bg-black/5 dark:bg-white/10 my-4"></div>

              <details>
                <summary class="cursor-pointer font-extrabold text-sm text-gray-600 dark:text-gray-300">
                  Технические детали
                </summary>
                <pre class="mt-3 text-xs bg-black/5 dark:bg-white/5 rounded-2xl p-4 max-h-64 overflow-auto">{{ prettyJson(item) }}</pre>
              </details>

              <button :class="actionBtnClass + ' absolute right-5 bottom-5'" @click="restoreItem(item)">
                Восстановить
              </button>
            </div>

          </div>

        </div>
      </div>
    </PageScrollWrapper>

    <!-- TOAST -->
    <div v-if="toast" class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
      <div
        class="px-5 py-3 rounded-full font-extrabold text-xs uppercase tracking-widest shadow-2xl border border-white/10"
        :class="toast.type === 'danger'
          ? 'bg-[#ff3b30] text-white'
          : toast.type === 'ok'
            ? 'bg-[#34c759] text-black'
            : 'bg-white text-black'"
      >
        {{ toast.message }}
      </div>
    </div>

    <!-- CONFIRM MODAL -->
    <div v-if="modal.open" class="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-5" @click.self="closeModal">
      <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#1C1C1E] p-5 shadow-2xl border border-black/10 dark:border-white/10">
        <div class="text-xl font-black text-[#1d1d1f] dark:text-white">
          {{ modal.title }}
        </div>
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-300 font-semibold">
          {{ modal.text }}
        </div>

        <div v-if="modal.details?.length" class="mt-4 rounded-2xl bg-black/5 dark:bg-white/5 p-4">
          <div v-for="d in modal.details" :key="d" class="text-xs font-bold text-gray-700 dark:text-gray-200">
            {{ d }}
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button :class="actionBtnClass" @click="closeModal">ОТМЕНА</button>
          <button
            :class="actionBtnClass"
            :disabled="modal.locked"
            @click="confirmModal"
          >
            {{ modal.confirmText }}
          </button>
        </div>

        <div v-if="modal.locked" class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-semibold">
          Подтверждение станет доступно через секунду…
        </div>
      </div>
    </div>
    <!-- DESTINATION MODAL (Modal #2) -->
    <div v-if="destModal.open" class="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-5" @click.self="closeDestModal">
      <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#1C1C1E] p-5 shadow-2xl border border-black/10 dark:border-white/10">
        <div class="text-xl font-black text-[#1d1d1f] dark:text-white">
          {{ destModal.title }}
        </div>
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-300 font-semibold">
          {{ destModal.text }}
        </div>

        <div class="mt-4">
          <ModernSelect
            v-model="destModal.selected"
            :options="destModal.options"
            :class="btnClass"
            placeholder="Выберите…"
          />
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button :class="actionBtnClass" @click="closeDestModal">НАЗАД</button>
          <button
            :class="actionBtnClass"
            :disabled="!destModal.selected || destModal.locked"
            @click="(async () => { 
              try { 
                destModal.locked = true; 
                await performRestore(destModal.item, destModal.selected); 
                closeDestModal(); 
              } catch (e) { 
                notificationError?.(e?.message || 'Ошибка восстановления'); 
                destModal.locked = false; 
              } 
            })()"
          >
            ВОССТАНОВИТЬ
          </button>
        </div>
      </div>
    </div>


  </div>
</template>
