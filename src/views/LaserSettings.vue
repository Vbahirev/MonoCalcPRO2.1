<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'; 
import { useDatabase } from '@/composables/useDatabase';
import { useHaptics } from '@/composables/useHaptics';
import ModernSelect from '@/components/ModernSelect.vue';
import { PageScrollWrapper } from '@/ui-core'; 
import draggable from 'vuedraggable';
import { MATERIAL_TYPE_CATALOG, getCoatingAllowedTypes, normalizeMaterialType } from '@/utils/coatingCompatibility';
import { buildDeepSearchBlob, getSearchVariants, normalizeSearchValue } from '@/utils/searchIndex';

const router = useRouter();
const route = useRoute();
const { 
    materials, coatings, processingDB, accessoriesDB, packagingDB, designDB, settings,
    saveFullDatabase, isRemoteUpdate, hasPermission // <--- Берем функцию прав
} = useDatabase();

const { impactLight, impactMedium, notificationSuccess, notificationError } = useHaptics();

// --- ПРАВА (STEP 6) ---
// View permissions
const canViewGlobal = computed(() => hasPermission('settings.global.view') || hasPermission('canViewSettings'));
const canViewMaterials = computed(() => hasPermission('settings.materials.read') || hasPermission('canViewSettings'));
const canViewPrices = computed(() => hasPermission('settings.prices.read') || hasPermission('canViewSettings'));

// Write permissions
const canEditConfig = computed(() => hasPermission('settings.global.write') || hasPermission('canEditGlobalSettings'));
const canEditMats = computed(() => hasPermission('settings.materials.write') || hasPermission('canEditMaterials'));
const canEditSvc = computed(() => hasPermission('settings.prices.write') || hasPermission('canEditPrices'));

// --- СОСТОЯНИЕ ---
const isSaving = ref(false);
const hasUnsavedChanges = ref(false); 
const highlightedId = ref(null); 
const deleteConfirmationId = ref(null);
const showLeaveModal = ref(false);
const pendingRoute = ref(null);
const activeTab = ref('all'); 
const scrollWrapper = ref(null); 
const searchQuery = ref(''); 
const customTypeInputByMaterialId = reactive({});

const ADD_NEW_TYPE_VALUE = '__add_new_type__';

// ... (Стили без изменений) ...
const btnClass = `h-14 bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-black/50 ring-1 ring-black/5 dark:ring-white/10 font-bold text-gray-400 dark:text-gray-500 transition-all duration-300 ease-out transform-gpu no-flicker hover:-translate-y-1 hover:text-gray-900 dark:hover:text-white hover:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.1)] dark:hover:shadow-black/70 hover:ring-black/10 dark:hover:ring-white/20 active:translate-y-0 active:shadow-sm flex items-center relative z-10 hover:z-20`;
const saveBtnClass = `h-14 w-40 rounded-2xl font-bold uppercase tracking-widest text-xs text-white dark:text-black shadow-[0_10px_20px_-5px_rgba(0,0,0,0.4)] dark:shadow-[0_10px_20px_-5px_rgba(255,255,255,0.15)] transition-all duration-300 ease-out transform-gpu active:translate-y-0 active:shadow-md flex items-center justify-center gap-2 relative z-30`;
const cardClass = `bg-white dark:bg-[#1C1C1E] rounded-[1.5rem] p-5 shadow-sm border border-gray-100 dark:border-white/5 relative group overflow-visible transition-all duration-300 transform-gpu hover:shadow-xl hover:-translate-y-1 hover:border-gray-200 dark:hover:border-white/20 hover:z-[100] focus-within:z-[100]`;

const searchVariants = computed(() => getSearchVariants(searchQuery.value));

const matchesItemSearch = (item) => {
    if (!searchVariants.value.length) return true;
    const blob = buildSearchBlob(item);
    return searchVariants.value.some(q => blob.includes(q));
};

const filterList = (list) => {
    const variants = searchVariants.value;
    if (!variants.length) return list;
    return (list || []).filter(item => {
        const blob = buildSearchBlob(item);
        return variants.some(q => blob.includes(q));
    });
};

const buildSearchBlob = (item) => {
    return buildDeepSearchBlob(item, 3, 80);
};

const configSearchBlob = computed(() => {
    return [
        'конфигурация',
        'экономика',
        'стоимость работы',
        'стоимость гравировки',
        'см²',
        'кв см',
        'лазер',
        'цена минуты',
        'коэффициент отходов',
        'доступ',
        settings.value?.laserMinuteCost,
        settings.value?.engravingPrice,
        settings.value?.wastage,
    ].map(v => String(v ?? '').trim()).filter(Boolean).join(' | ').toLowerCase();
});

const configMatchesSearch = computed(() => {
    const variants = searchVariants.value;
    if (!variants.length) return true;
    return variants.some(q => configSearchBlob.value.includes(q));
});

const allSections = computed(() => {
    const list = [];

    // Конфигурация (глобальные настройки)
    if (canViewGlobal.value) {
        list.push({ id: 'config', label: 'Конфигурация', isConfig: true, matchesSearch: configMatchesSearch.value });
    }

    // Материалы
    if (canViewMaterials.value) {
        list.push({ id: 'materials', label: 'Материалы', list: filterList(materials.value), type: 'materials' });
    }

    // Цены / услуги / прочие справочники
    if (canViewPrices.value) {
        list.push({ id: 'coatings', label: 'Покрытия', list: filterList(coatings.value), type: 'coatings' });
        list.push({ id: 'processing', label: 'Услуги', list: filterList(processingDB.value), type: 'processing' });
        list.push({ id: 'accessories', label: 'Фурнитура', list: filterList(accessoriesDB.value), type: 'accessories' });
        list.push({ id: 'packaging', label: 'Упаковка', list: filterList(packagingDB.value), type: 'packaging' });
        list.push({ id: 'design', label: 'Дизайн', list: filterList(designDB.value), type: 'design' });
    }

    return list;
});

const tabs = computed(() => [{ id: 'all', label: 'Все' }, ...allSections.value.map(s => ({ id: s.id, label: s.label }))]);
const visibleSections = computed(() => {
    const hasQuery = String(searchQuery.value || '').trim().length > 0;
    const sourceSections = activeTab.value === 'all'
        ? allSections.value
        : allSections.value.filter(s => s.id === activeTab.value);

    if (!hasQuery) return sourceSections;

    return sourceSections.filter(s => s.isConfig ? s.matchesSearch : (s.list && s.list.length > 0));
});
const getSectionRef = (type) => ({ materials, coatings, processing: processingDB, accessories: accessoriesDB, packaging: packagingDB, design: designDB }[type]);

const getPreferredTypeOrder = () => {
    const raw = Array.isArray(settings.value?.materialTypeOrder) ? settings.value.materialTypeOrder : [];
    return [...new Set(raw.map(normalizeMaterialType).filter(Boolean))];
};

const materialTypeCounts = computed(() => {
    const counts = {};
    (materials.value || []).forEach(item => {
        const type = normalizeMaterialType(item?.type);
        counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
});

const orderedMaterialTypes = computed(() => {
    const presentTypes = Object.keys(materialTypeCounts.value);
    const preferred = getPreferredTypeOrder();
    const fromPreferred = preferred.filter(type => presentTypes.includes(type));
    const rest = presentTypes.filter(type => !fromPreferred.includes(type));
    return [...fromPreferred, ...rest];
});

const materialTypeMiniatures = computed({
    get: () => orderedMaterialTypes.value.map(type => ({
        value: type,
        label: MATERIAL_TYPE_CATALOG.find(item => item.value === type)?.label || type,
        count: materialTypeCounts.value[type] || 0,
    })),
    set: (nextOrder) => {
        if (!canEditMats.value) return;
        const values = (nextOrder || []).map(item => normalizeMaterialType(item?.value)).filter(Boolean);
        settings.value.materialTypeOrder = [...new Set(values)];
        sortMaterialsByTypeBlocks();
        markDirty();
    }
});

const getTypeOrderMap = () => {
    const orderMap = new Map();
    orderedMaterialTypes.value.forEach((type, idx) => orderMap.set(type, idx));
    return orderMap;
};

const sortMaterialsByTypeBlocks = () => {
    const current = Array.isArray(materials.value) ? [...materials.value] : [];
    const orderMap = getTypeOrderMap();
    const sorted = [...current].sort((a, b) => {
        const typeA = normalizeMaterialType(a?.type);
        const typeB = normalizeMaterialType(b?.type);
        const indexA = orderMap.has(typeA) ? orderMap.get(typeA) : Number.MAX_SAFE_INTEGER;
        const indexB = orderMap.has(typeB) ? orderMap.get(typeB) : Number.MAX_SAFE_INTEGER;
        if (indexA !== indexB) return indexA - indexB;
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'ru', { sensitivity: 'base' });
    });

    const beforeOrder = current.map(item => item?.id || item?.name || '').join('|');
    const afterOrder = sorted.map(item => item?.id || item?.name || '').join('|');
    if (beforeOrder !== afterOrder) {
        materials.value = sorted;
    }
};

const materialTypeOptions = computed(() => {
    const fromMaterials = (materials.value || [])
        .map(item => normalizeMaterialType(item?.type))
        .filter(Boolean);

    const allTypes = [...new Set([...MATERIAL_TYPE_CATALOG.map(t => t.value), ...fromMaterials])];
    return allTypes.map(value => {
        const inCatalog = MATERIAL_TYPE_CATALOG.find(item => item.value === value);
        return inCatalog || { value, label: value };
    });
});

const materialTypeOptionsForCoatings = computed(() => {
    return orderedMaterialTypes.value.map(value => {
        const inCatalog = MATERIAL_TYPE_CATALOG.find(item => item.value === value);
        return inCatalog || { value, label: value };
    });
});

const materialTypeSelectOptions = computed(() => {
    return [
        ...materialTypeOptionsForCoatings.value,
        { value: ADD_NEW_TYPE_VALUE, label: 'Добавить новый тип…' }
    ];
});

const openCustomMaterialTypeInput = (materialId) => {
    customTypeInputByMaterialId[materialId] = customTypeInputByMaterialId[materialId] || '';
};

const closeCustomMaterialTypeInput = (materialId) => {
    delete customTypeInputByMaterialId[materialId];
};

const onMaterialTypeSelect = (item, selectedValue) => {
    if (!canEditMats.value) return;
    if (selectedValue === ADD_NEW_TYPE_VALUE) {
        openCustomMaterialTypeInput(item.id);
        return;
    }
    item.type = normalizeMaterialType(selectedValue);
    closeCustomMaterialTypeInput(item.id);
    sortMaterialsByTypeBlocks();
    markDirty();
};

const applyCustomMaterialType = (item) => {
    if (!canEditMats.value) return;
    const raw = customTypeInputByMaterialId[item.id];
    const normalized = normalizeMaterialType(raw);
    if (!normalized || normalized === 'other') return;
    item.type = normalized;
    closeCustomMaterialTypeInput(item.id);
    sortMaterialsByTypeBlocks();
    markDirty();
};

const isCoatingTypeEnabled = (coating, type) => {
    const allowed = getCoatingAllowedTypes(coating);
    if (type === 'all') return allowed.includes('all');
    return allowed.includes(type) && !allowed.includes('all');
};

const toggleCoatingType = (coating, type) => {
    if (!coating || !canEditSvc.value) return;

    const current = getCoatingAllowedTypes(coating);
    if (type === 'all') {
        coating.allowedMaterialTypes = ['all'];
        markDirty();
        return;
    }

    const base = current.includes('all') ? [] : [...current];
    const exists = base.includes(type);
    const next = exists ? base.filter(t => t !== type) : [...base, type];
    coating.allowedMaterialTypes = next.length ? next : ['all'];
    markDirty();
};

// STEP 6: granular edit capability per section
const canEditSection = (section) => {
    if (!section) return false;
    if (section.isConfig) return !!canEditConfig.value;
    if (section.type === 'materials') return !!canEditMats.value;
    // coatings/processing/accessories/packaging/design are treated as "prices" block
    return !!canEditSvc.value;
};

const addItemToSection = (sectionId) => {
    // ПРОВЕРКА ПРАВ (write)
    if (sectionId === 'materials' && !canEditMats.value) return notificationError('Нет прав на материалы');
    if (sectionId !== 'materials' && !canEditSvc.value) return notificationError('Нет прав');
    
    impactLight();
    const ts = Date.now();
    let newItem = { id: `${sectionId}_${ts}`, name: '', price: 0 };
    if (sectionId === 'materials') newItem = { ...newItem, type: 'plastic', sheetW: 0, sheetH: 0, sheetPrice: 0, speed: 20 };
    if (sectionId === 'coatings') newItem = { ...newItem, allowedMaterialTypes: ['all'] };
    else if (sectionId === 'processing') newItem = { ...newItem, type: 'fixed', value: 0 };
    
    const refList = getSectionRef(sectionId);
    if(refList) {
        refList.value.unshift(newItem); 
        if (sectionId === 'materials') sortMaterialsByTypeBlocks();
        highlightedId.value = newItem.id;
        markDirty();
        setTimeout(() => highlightedId.value = null, 2000); 
    }
};

const askRemoveItem = (id, section) => { 
    // Проверка прав на удаление
    if (!canEditSection(section)) return notificationError('Нет прав'); 
    impactMedium(); deleteConfirmationId.value = id; 
};
const cancelDelete = () => { impactLight(); deleteConfirmationId.value = null; };
const confirmDelete = (list, id) => { const idx = list.findIndex(i => i.id === id); if (idx !== -1) { list.splice(idx, 1); impactMedium(); markDirty(); } deleteConfirmationId.value = null; };

watch([materials, coatings, processingDB, accessoriesDB, packagingDB, designDB, settings], () => {
    if (isRemoteUpdate.value) return; 
    markDirty(); 
}, { deep: true });

watch(
    [() => (settings.value?.materialTypeOrder || []).join('|'), () => materials.value.length],
    () => {
        if (!materials.value?.length) return;
        sortMaterialsByTypeBlocks();
    },
    { immediate: true }
);

const onDragEnd = () => { impactLight(); markDirty(); };

onBeforeRouteLeave((to, from, next) => {
    // Блокируем выход только если есть права на редактирование
    const canEditSomething = canEditConfig.value || canEditMats.value || canEditSvc.value;
    if (hasUnsavedChanges.value && canEditSomething) { impactMedium(); pendingRoute.value = to; showLeaveModal.value = true; next(false); } else { next(); }
});

const confirmLeave = () => { hasUnsavedChanges.value = false; showLeaveModal.value = false; if (pendingRoute.value) router.push(pendingRoute.value); };
const markDirty = () => { if (!hasUnsavedChanges.value) hasUnsavedChanges.value = true; };
const queryCalcId = computed(() => {
    const raw = route.query.calc;
    if (Array.isArray(raw)) return raw[0] || 'laser';
    return raw || 'laser';
});

const goBack = () => {
    impactLight();
    if (route.query.from === 'calc') {
        router.push(`/calc/${queryCalcId.value}`);
        return;
    }
    router.push('/settings');
};

const handleSave = async () => {
    if (!canEditConfig.value && !canEditMats.value && !canEditSvc.value) { notificationError("Нет прав"); return; }
    isSaving.value = true;
    impactMedium();
    try {
        const success = await saveFullDatabase();
        if (success) {
            hasUnsavedChanges.value = false; 
            notificationSuccess('Настройки сохранены в облако');
        }
    } catch (e) { notificationError('Ошибка сохранения'); } finally { isSaving.value = false; }
};

const operationTypes = [
    { value: 'fixed', label: 'Фикс.' },
    { value: 'pieces', label: 'Шт.' },
    { value: 'percent', label: '%' },
    { value: 'linear', label: 'М.' },
    { value: 'linear_mm', label: 'ММ' },
    { value: 'area', label: 'М²' },
    { value: 'area_mm2', label: 'ММ²' }
];
const updateWidth = () => { };
onMounted(() => { window.addEventListener('resize', updateWidth); });
onUnmounted(() => { window.removeEventListener('resize', updateWidth); });
</script>

<template>
    <div class="h-screen w-full bg-[#F5F5F7] dark:bg-[#121212] overflow-hidden flex flex-col relative transition-colors duration-500">
        
        <Teleport to="body">
            <Transition name="modal-scale">
                <div v-if="showLeaveModal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="showLeaveModal = false">
                    <div class="bg-white dark:bg-[#1C1C1E] w-full max-w-xs rounded-[2rem] p-6 shadow-2xl border border-gray-100 dark:border-white/10 flex flex-col items-center text-center">
                        <div class="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center mb-4"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
                        <h3 class="text-xl font-black text-[#1d1d1f] dark:text-white mb-2">Не сохранено!</h3>
                        <p class="text-sm text-gray-500 mb-6 font-medium">Все изменения будут потеряны.</p>
                        <div class="flex gap-3 w-full">
                            <button @click="showLeaveModal = false" class="flex-1 h-12 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-black font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all">Остаться</button>
                            <button @click="confirmLeave" class="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">Выйти</button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <PageScrollWrapper ref="scrollWrapper" class="flex-1">
            <div class="pb-32 pt-2 relative min-h-full flex flex-col w-full pt-6">
                <div class="max-w-5xl mx-auto px-5 w-full relative z-10">
                    
                    <div class="flex items-center justify-center relative mb-8 animate-fade-in-down">
                        <h1 class="text-3xl md:text-5xl font-black text-[#1d1d1f] dark:text-white tracking-tighter leading-none text-center px-6 py-2 transition-colors duration-300">
                            Настройки <span class="inline-block text-transparent bg-clip-text bg-gradient-to-br from-gray-600 to-black dark:from-gray-300 dark:to-white">Лазера</span>
                        </h1>
                    </div>
                    
                    <div class="relative flex flex-col sm:flex-row gap-3 w-full mb-8 animate-fade-in-up z-40 items-center">
                        <button @click="goBack" :class="[btnClass, 'px-5 justify-center gap-2 shrink-0 w-full sm:w-auto']"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg><span class="font-bold text-sm">Назад</span></button>
                        <div class="relative flex-1 group w-full flex items-center gap-2" :class="btnClass">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><svg class="text-inherit transition-colors duration-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
                            <input v-model="searchQuery" class="block w-full h-full pl-12 pr-12 bg-transparent rounded-2xl text-sm font-bold outline-none text-inherit placeholder-gray-400/70 transition-colors cursor-text" placeholder="Найти материал...">
                        </div>
                        <ModernSelect v-model="activeTab" :options="tabs" placeholder="Категория" :class="btnClass" class="sm:w-auto w-full px-0" />
                        
                        <button 
                            v-if="canEditConfig || canEditMats || canEditSvc"
                            @click="handleSave" 
                            :disabled="isSaving"
                            :class="[saveBtnClass, 'bg-black dark:bg-white', isSaving ? 'opacity-80 cursor-wait' : '', !isSaving && hasUnsavedChanges ? 'btn-pulse' : 'opacity-100', 'hover:-translate-y-1 hover:shadow-lg']"
                        >
                            <div v-if="isSaving" class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 0.2s"></span></div>
                            <span v-else>Сохранить</span>
                        </button>
                        
                        <div v-else class="h-14 px-6 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center gap-2 text-gray-400 font-bold text-xs uppercase tracking-wider cursor-not-allowed">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <span>Только чтение</span>
                        </div>
                    </div>

                    <div class="space-y-12 animate-fade-in-up" style="animation-delay: 0.2s;">
                        <section v-for="section in visibleSections" :key="section.id" :id="`section-${section.id}`" class="scroll-mt-64">
                            <div class="flex items-center gap-3 mb-6">
                                <div class="w-1.5 h-6 bg-black dark:bg-white rounded-full"></div>
                                <h2 class="text-xl font-black text-black dark:text-white">{{ section.label }}</h2>
                                <span v-if="!section.isConfig" class="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">{{ section.list.length }}</span>
                            </div>

                            <div v-if="section.isConfig" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div :class="cardClass">
                                    <div class="flex items-center gap-4 mb-5">
                                        <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-500 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>
                                        <div>
                                            <label class="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Доступ</label>
                                            <h3 class="font-black text-black dark:text-white text-lg leading-none">
                                                {{ canEditConfig || canEditMats ? 'Редактор' : 'Пользователь' }}
                                            </h3>
                                        </div>
                                    </div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400 font-medium">Ваш уровень доступа ограничен выданными правами.</div>
                                </div>
                                <div :class="cardClass">
                                    <div class="flex items-center gap-4 mb-5">
                                        <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg></div>
                                        <div><label class="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Экономика</label><h3 class="font-black text-black dark:text-white text-lg leading-none">Стоимость работы</h3></div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <input v-model.number="settings.laserMinuteCost" @input="markDirty" :disabled="!canEditConfig" type="number" class="w-full bg-gray-50 dark:bg-black/20 h-14 rounded-2xl px-5 font-black outline-none dark:text-white text-right text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                        <span class="font-bold text-gray-400 text-sm">₽/мин</span>
                                    </div>
                                </div>

                                <div :class="cardClass">
                                    <div class="flex items-center gap-4 mb-5">
                                        <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 12h16"></path><path d="M12 4v16"></path></svg></div>
                                        <div><label class="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Гравировка</label><h3 class="font-black text-black dark:text-white text-lg leading-none">Стоимость за см²</h3></div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <input v-model.number="settings.engravingPrice" @input="markDirty" :disabled="!canEditConfig" type="number" min="0" step="0.01" class="w-full bg-gray-50 dark:bg-black/20 h-14 rounded-2xl px-5 font-black outline-none dark:text-white text-right text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                        <span class="font-bold text-gray-400 text-sm">₽/см²</span>
                                    </div>
                                    <p class="mt-2 text-[10px] font-medium text-gray-400">В калькуляторе размеры вводятся в мм и автоматически переводятся в см² для расчёта.</p>
                                </div>

                                <div :class="cardClass">
                                    <div class="flex items-center gap-4 mb-5">
                                        <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18"></path><path d="M3 12h12"></path><path d="M3 17h8"></path></svg></div>
                                        <div><label class="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Материал</label><h3 class="font-black text-black dark:text-white text-lg leading-none">Коэффициент отходов</h3></div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <input v-model.number="settings.wastage" @input="markDirty" :disabled="!canEditConfig" type="number" step="0.01" min="0" class="w-full bg-gray-50 dark:bg-black/20 h-14 rounded-2xl px-5 font-black outline-none dark:text-white text-right text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                        <span class="font-bold text-gray-400 text-sm">%</span>
                                    </div>
                                    <p class="mt-2 text-[10px] font-medium text-gray-400">Формат: 1.00 = без добавки, 1.25 = +25% к стоимости материала.</p>
                                </div>

                            </div>

                            <template v-else>
                                <div v-if="section.type === 'materials' && materialTypeMiniatures.length" class="mb-4">
                                    <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Порядок блоков типов (перетащите)</div>
                                    <draggable
                                        v-model="materialTypeMiniatures"
                                        item-key="value"
                                        tag="div"
                                        class="flex flex-wrap gap-2"
                                        :animation="200"
                                        ghost-class="type-mini-ghost"
                                        :disabled="!canEditMats"
                                    >
                                        <template #item="{ element }">
                                            <div class="h-9 px-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1C1C1E] flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200 cursor-grab active:cursor-grabbing select-none">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="text-gray-400"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
                                                <span>{{ element.label }}</span>
                                                <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">{{ element.count }}</span>
                                            </div>
                                        </template>
                                    </draggable>
                                </div>

                                <draggable v-if="getSectionRef(section.type)" v-model="getSectionRef(section.type).value" item-key="id" tag="div" class="grid grid-cols-1 md:grid-cols-2 gap-4" handle=".drag-handle" :animation="250" ghost-class="ghost-card" @end="onDragEnd" :disabled="!canEditSection(section)">
                                    <template #header>
                                        <button v-if="canEditSection(section)" @click="addItemToSection(section.id)" class="min-h-[220px] rounded-[1.5rem] border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-600 font-bold uppercase text-[10px] tracking-widest hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-all flex flex-col items-center justify-center gap-3 group sm:col-span-1 opacity-70 hover:opacity-100 h-full hover:z-30 relative no-flicker">
                                            <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black shadow-sm"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>
                                            <span>Добавить</span>
                                        </button>
                                    </template>
                                    
                                    <template #item="{ element: item }">
                                        <div v-if="matchesItemSearch(item)" :class="[cardClass, section.type === 'processing' ? 'min-h-[220px] h-full flex flex-col' : '', {'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/10': highlightedId === item.id}]">
                                            
                                            <div v-if="deleteConfirmationId === item.id" class="absolute inset-0 z-50 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 transition-all duration-300 rounded-[1.5rem]">
                                                <div class="text-red-500 mb-2"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></div>
                                                <h3 class="font-black text-black dark:text-white text-lg mb-1">Удалить?</h3>
                                                <div class="flex gap-2 w-full mt-4">
                                                    <button
                                                        @click="cancelDelete"
                                                        class="flex-1 h-11 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase tracking-wide transition-all duration-200 hover:bg-gray-200 dark:hover:bg-white/20 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
                                                    >
                                                        Отмена
                                                    </button>
                                                    <button
                                                        @click="confirmDelete(getSectionRef(section.type).value, item.id)"
                                                        class="flex-1 h-11 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-wide transition-all duration-200 hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-8px_rgba(239,68,68,0.9)] active:translate-y-0 active:shadow-sm"
                                                    >
                                                        Удалить
                                                    </button>
                                                </div>
                                            </div>

                                            <div class="flex justify-between items-start gap-3 mb-4">
                                                <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-black dark:hover:text-white p-1.5 -ml-2 transition-colors flex items-center gap-1 group/handle" :class="{'opacity-0 pointer-events-none': !canEditSection(section)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg></div>
                                                <input v-model="item.name" @input="markDirty" :disabled="!canEditSection(section)" class="flex-1 font-black text-lg outline-none bg-transparent placeholder-gray-300 dark:placeholder-gray-600 dark:text-white leading-tight disabled:text-gray-500" placeholder="Название">
                                                <button v-if="canEditSection(section)" @click="askRemoveItem(item.id, section)" class="text-gray-300 hover:text-red-500 transition-colors p-1.5 -mr-1.5 -mt-1.5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg></button>
                                            </div>
                                            
                                            <div class="bg-gray-50 dark:bg-black/20 rounded-2xl p-4 grid gap-3" :class="section.type === 'processing' ? 'mt-auto' : ''">
                                                <template v-if="section.type === 'materials'">
                                                    <div><label class="text-[9px] font-bold uppercase text-gray-400 mb-1.5 block">Размер листа (мм)</label><div class="flex items-center gap-2"><input v-model.number="item.sheetW" :disabled="!canEditMats" @input="markDirty" placeholder="W" class="w-full bg-white dark:bg-white/10 rounded-xl py-2 px-3 text-sm font-bold text-center outline-none dark:text-white shadow-sm focus:ring-1 ring-black/10 transition-all disabled:opacity-70"><span class="text-gray-300 text-sm">×</span><input v-model.number="item.sheetH" :disabled="!canEditMats" @input="markDirty" placeholder="H" class="w-full bg-white dark:bg-white/10 rounded-xl py-2 px-3 text-sm font-bold text-center outline-none dark:text-white shadow-sm focus:ring-1 ring-black/10 transition-all disabled:opacity-70"></div></div>
                                                    <div>
                                                        <label class="text-[9px] font-bold uppercase text-gray-400 mb-1.5 block">Тип материала</label>
                                                        <ModernSelect
                                                            :model-value="item.type"
                                                            :disabled="!canEditMats"
                                                            @update:modelValue="(val) => onMaterialTypeSelect(item, val)"
                                                            :options="materialTypeSelectOptions"
                                                            placeholder="Тип"
                                                            class="w-full text-xs"
                                                        />

                                                        <div v-if="customTypeInputByMaterialId[item.id] !== undefined" class="mt-2 flex items-center gap-2">
                                                            <input
                                                                v-model="customTypeInputByMaterialId[item.id]"
                                                                :disabled="!canEditMats"
                                                                placeholder="Новый тип (например: mdf)"
                                                                class="flex-1 bg-white dark:bg-white/10 rounded-xl py-2 px-3 text-xs font-bold outline-none dark:text-white shadow-sm focus:ring-1 ring-black/10 transition-all disabled:opacity-70"
                                                            >
                                                            <button
                                                                type="button"
                                                                :disabled="!canEditMats"
                                                                @click="applyCustomMaterialType(item)"
                                                                class="h-9 px-3 rounded-xl bg-black text-white dark:bg-white dark:text-black text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                                                            >
                                                                Добавить
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div class="grid grid-cols-2 gap-3 pt-1">
                                                        <div><label class="text-[9px] font-bold uppercase text-gray-400 mb-1.5 block">Скорость</label><div class="relative"><input v-model.number="item.speed" :disabled="!canEditMats" @input="markDirty" placeholder="0" class="w-full bg-white dark:bg-white/10 rounded-xl py-2 px-3 text-sm font-bold text-center outline-none dark:text-white shadow-sm text-blue-500 focus:ring-1 ring-blue-500/30 transition-all disabled:opacity-70"><div class="absolute inset-y-0 right-2 flex items-center pointer-events-none text-blue-300"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg></div></div></div>
                                                        <div><label class="text-[9px] font-bold uppercase text-gray-400 mb-1.5 block">Цена листа</label><div class="relative"><input v-model.number="item.sheetPrice" :disabled="!canEditMats" @input="markDirty" placeholder="0" class="w-full bg-white dark:bg-white/10 rounded-xl pl-3 pr-6 py-2 text-sm font-black outline-none dark:text-white shadow-sm focus:ring-1 ring-black/10 transition-all disabled:opacity-70"><span class="absolute right-2 top-2 text-xs font-bold text-gray-400">₽</span></div></div>
                                                    </div>
                                                </template>
                                                <template v-else>
                                                    <div class="grid grid-cols-2 gap-3">
                                                        <div v-if="section.type === 'processing'"><label class="text-[9px] font-bold uppercase text-gray-400 mb-1.5 block">Тип</label><ModernSelect v-model="item.type" :disabled="!canEditSvc" @update:modelValue="markDirty" :options="operationTypes" placeholder="Тип" class="w-full text-xs" /></div>
                                                        <div :class="{'col-span-2': section.type !== 'processing'}"><label class="text-[9px] font-bold uppercase text-gray-400 mb-1.5 block">{{ section.type === 'coatings' ? 'Цена (см²)' : 'Цена' }}</label><div class="relative"><input v-model.number="item.price" :disabled="!canEditSvc" @input="markDirty" placeholder="0" class="w-full h-14 bg-white dark:bg-[#232326] rounded-2xl border border-gray-200 dark:border-white/10 pl-4 pr-8 text-sm font-black outline-none dark:text-white shadow-sm dark:shadow-black/40 focus:ring-1 ring-black/10 transition-all disabled:opacity-70"><span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₽</span></div></div>
                                                    </div>
                                                    <p v-if="section.type === 'coatings'" class="text-[10px] font-medium text-gray-400">Цена указывается за 1 см², далее стоимость считается пропорционально площади детали.</p>
                                                    <div v-if="section.type === 'coatings'" class="pt-1">
                                                        <label class="text-[9px] font-bold uppercase text-gray-400 mb-2 block">Совместимость материалов</label>
                                                        <div class="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                :disabled="!canEditSvc"
                                                                @click="toggleCoatingType(item, 'all')"
                                                                class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-colors"
                                                                :class="isCoatingTypeEnabled(item, 'all') ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'"
                                                            >
                                                                Все
                                                            </button>
                                                            <button
                                                                v-for="typeOption in materialTypeOptionsForCoatings"
                                                                :key="typeOption.value"
                                                                type="button"
                                                                :disabled="!canEditSvc"
                                                                @click="toggleCoatingType(item, typeOption.value)"
                                                                class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-colors"
                                                                :class="isCoatingTypeEnabled(item, typeOption.value) ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'"
                                                            >
                                                                {{ typeOption.label }}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </template>
                                            </div>
                                        </div>
                                    </template>
                                </draggable>
                            </template>
                        </section>
                        <div v-if="visibleSections.length === 0" class="text-center py-20 text-gray-400 font-bold bg-white dark:bg-[#1C1C1E] rounded-3xl border border-dashed border-gray-200 dark:border-white/10">Ничего не найдено</div>
                    </div>

                </div>
            </div>
        </PageScrollWrapper>
    </div>
</template>

<style>
.ghost-card { background-color: rgba(59, 130, 246, 0.05) !important; border: 1px dashed #3b82f6 !important; opacity: 1 !important; box-shadow: none !important; border-radius: 1.5rem !important; outline: none !important; }
.ghost-card > * { visibility: hidden; }
.dark .ghost-card { background-color: rgba(255, 255, 255, 0.03) !important; border-color: rgba(255, 255, 255, 0.2) !important; }
.sortable-drag { outline: none !important; }
.type-mini-ghost { opacity: 0.65 !important; }
</style>

<style scoped>
.animate-fade-in-down { animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; opacity: 0; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ripple { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.5); opacity: 0; } }
.btn-pulse::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: inherit; z-index: -1; background-color: rgba(0, 0, 0, 0.4); animation: ripple 1.5s infinite cubic-bezier(0.4, 0, 0.2, 1); }
.dark .btn-pulse::after { background-color: rgba(255, 255, 255, 0.4); }
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; backdrop-filter: blur(0); }
.modal-fade-enter-from .transform, .modal-fade-leave-to { transform: scale(0.9) translateY(20px); opacity: 0; }
.modal-scale-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-scale-leave-active { transition: all 0.2s ease-in; }
.modal-scale-enter-from, .modal-scale-leave-to { opacity: 0; transform: scale(0.9); }
.no-flicker { will-change: transform; backface-visibility: hidden; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
</style>