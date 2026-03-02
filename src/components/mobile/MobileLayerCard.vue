<script setup>
import { ref } from 'vue';
import { useHaptics } from '../../composables/useHaptics';

const props = defineProps({
    layer: Object,
    materials: Array,
    coatings: { type: Array, default: () => [] }
});

const emit = defineEmits(['remove', 'duplicate', 'edit']);
const { impactMedium, notificationError, notificationSuccess } = useHaptics();

// --- СВАЙПЫ ---
const touchStartX = ref(0);
const touchStartY = ref(0);
const isDragging = ref(false);
const cardOffset = ref(0);
const SWIPE_THRESHOLD = 80;
const wasHapticTriggered = ref(false);

const onTouchStart = (e) => {
    touchStartX.value = e.touches[0].clientX;
    touchStartY.value = e.touches[0].clientY;
    isDragging.value = true;
    wasHapticTriggered.value = false;
};

const onTouchMove = (e) => {
    if (!isDragging.value) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const xDiff = currentX - touchStartX.value;
    const yDiff = currentY - touchStartY.value;

    // Блокируем свайп, если скроллим страницу
    if (Math.abs(yDiff) > Math.abs(xDiff)) {
        isDragging.value = false;
        cardOffset.value = 0;
        return;
    }
    if (e.cancelable) e.preventDefault(); 
    cardOffset.value = xDiff * 0.7;

    if (Math.abs(cardOffset.value) > SWIPE_THRESHOLD && !wasHapticTriggered.value) {
        impactMedium();
        wasHapticTriggered.value = true;
    } else if (Math.abs(cardOffset.value) < SWIPE_THRESHOLD && wasHapticTriggered.value) {
        wasHapticTriggered.value = false;
    }
};

const onTouchEnd = () => {
    if (!isDragging.value) return;
    isDragging.value = false;
    if (cardOffset.value > SWIPE_THRESHOLD) { notificationSuccess(); emit('duplicate'); }
    else if (cardOffset.value < -SWIPE_THRESHOLD) { notificationError(); emit('remove'); }
    cardOffset.value = 0;
    wasHapticTriggered.value = false;
};

// Хелперы
const getMaterialName = (id) => props.materials.find(mat => mat.id === id)?.name || 'Материал не выбран';
const getCoatingName = (id) => {
    if (!id || id === 'none') return null;
    return props.coatings?.find(c => c.id === id)?.name || null;
};
</script>

<template>
    <div class="relative w-full select-none touch-pan-y transform transition-all duration-300 mb-3">
        
        <div class="absolute inset-0 rounded-[1.5rem] flex justify-between items-center px-0 overflow-hidden">
            <div class="absolute inset-y-0 left-0 w-1/2 bg-green-500 flex items-center justify-start pl-6 transition-all duration-300 rounded-l-[1.5rem]" :style="{ opacity: cardOffset > 0 ? 1 : 0 }">
                <div class="flex items-center gap-2 text-white font-bold" :style="{ transform: `translateX(${Math.min(0, cardOffset - 80)}px)` }">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span class="text-[10px] uppercase font-black tracking-widest">Копия</span>
                </div>
            </div>
            <div class="absolute inset-y-0 right-0 w-1/2 bg-red-500 flex items-center justify-end pr-6 transition-all duration-300 rounded-r-[1.5rem]" :style="{ opacity: cardOffset < 0 ? 1 : 0 }">
                <div class="flex items-center gap-2 text-white font-bold" :style="{ transform: `translateX(${Math.max(0, cardOffset + 80)}px)` }">
                    <span class="text-[10px] uppercase font-black tracking-widest">Удалить</span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </div>
            </div>
        </div>

        <div 
            class="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 relative z-10 will-change-transform overflow-hidden active:bg-gray-50 active:scale-[0.98] transition-all duration-200"
            :style="{ transform: `translateX(${cardOffset}px)`, transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)' }"
            @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd"
            @click="emit('edit')"
        >
            <div class="p-4 flex flex-col gap-2">
                <div class="flex justify-between items-start">
                    <div class="flex flex-col min-w-0 pr-2">
                        <span class="font-black text-[15px] text-gray-900 leading-tight truncate">{{ layer.name || 'Деталь' }}</span>
                        <span class="text-[11px] font-bold text-gray-500 truncate mt-0.5">{{ getMaterialName(layer.matId) }}</span>
                    </div>
                    <span class="bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0">{{ layer.qty }} шт</span>
                </div>

                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                    
                    <div class="flex items-center gap-1.5 bg-[#F5F5F7] px-2 py-1.5 rounded-md shrink-0">
                        <span v-if="layer.w && layer.h" class="text-[10px] font-bold text-gray-700">{{ layer.w }}<span class="text-gray-400 mx-0.5">x</span>{{ layer.h }}<span class="text-[9px] text-gray-400 ml-0.5">мм</span></span>
                        <span v-else class="text-[10px] text-red-500 font-bold">Размер не задан</span>
                    </div>

                    <div v-if="layer.area" class="flex items-center gap-1.5 bg-[#F5F5F7] px-2 py-1.5 rounded-md shrink-0">
                         <span class="text-[10px] font-bold text-gray-700">{{ layer.area }}<span class="text-[9px] text-gray-400 ml-0.5">см²</span></span>
                    </div>

                    <div v-if="layer.cut > 0" class="flex items-center gap-1.5 bg-blue-50 px-2 py-1.5 rounded-md shrink-0 border border-blue-100/50">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span class="text-[10px] font-bold text-blue-600">{{ layer.cut }}<span class="text-[9px] opacity-70 ml-0.5">мм</span></span>
                    </div>

                    <div v-if="getCoatingName(layer.finishing)" class="flex items-center gap-1.5 bg-purple-50 px-2 py-1.5 rounded-md shrink-0 border border-purple-100/50">
                        <div class="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        <span class="text-[10px] font-bold text-purple-600 truncate max-w-[100px]">{{ getCoatingName(layer.finishing) }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
</style>