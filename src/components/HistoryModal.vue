<script setup>
import { ref, onMounted, computed } from 'vue';
import { useDatabase } from '@/composables/useDatabase';
import { useCalculator } from '@/core/useCalculator';

const props = defineProps({
    currentName: String
});

const emit = defineEmits(['close', 'load', 'save']);
const { settings, deleteFromHistory } = useCalculator('laser');
const { getCloudHistory } = useDatabase();



const projects = ref([]);
const isLoading = ref(true);
const projectName = ref(props.currentName || '');
const isSaving = ref(false);
const error = ref('');

// Состояние для красивых модалок подтверждения
const confirmModal = ref({
    show: false,
    type: null, // 'load' или 'delete'
    item: null
});

// Функция загрузки списка
const fetchProjects = async () => {
    isLoading.value = true;
    error.value = '';
    try {        const data = await getCloudHistory();
        
        if (data && data.status === 'error') {
            error.value = data.message;
        } else if (Array.isArray(data)) {
            projects.value = data;
        } else if (data.result && Array.isArray(data.result)) {
             projects.value = data.result;
        }
    } catch (e) {
        error.value = 'Ошибка сети';
        console.error(e);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    fetchProjects();
});

const handleSave = async () => {
    if (!projectName.value.trim()) return;
    isSaving.value = true;
    emit('save', projectName.value); 
    setTimeout(() => isSaving.value = false, 1000);
};

// --- ЛОГИКА ПОДТВЕРЖДЕНИЙ ---

const requestLoad = (p) => {
    confirmModal.value = { show: true, type: 'load', item: p };
};

const requestDelete = (p) => {
    confirmModal.value = { show: true, type: 'delete', item: p };
};

const closeConfirm = () => {
    confirmModal.value.show = false;
    setTimeout(() => {
        confirmModal.value.item = null;
        confirmModal.value.type = null;
    }, 300);
};

const executeAction = async () => {
    const p = confirmModal.value.item;
    const type = confirmModal.value.type;
    
    // Закрываем модалку подтверждения
    confirmModal.value.show = false;

    if (type === 'load') {
        // Логика загрузки
        emit('load', p.state, p.id);
    } 
    else if (type === 'delete') {
        // Логика удаления
        try {
            isLoading.value = true;
            await deleteFromHistory(p.id);
            await fetchProjects();
        } catch (e) {
            alert(e.message);
            isLoading.value = false;
        }
    }
};

// Тексты для модалки
const modalContent = computed(() => {
    const p = confirmModal.value.item;
    if (confirmModal.value.type === 'load') {
        return {
            title: 'Загрузить проект?',
            text: `Текущие данные будут заменены данными из проекта "${p?.name}".`,
            btnText: 'Загрузить',
            btnClass: 'bg-black text-white hover:bg-gray-800'
        };
    } else {
        return {
            title: 'Удалить проект?',
            text: `Вы действительно хотите удалить проект "${p?.name}" из истории навсегда?`,
            btnText: 'Удалить',
            btnClass: 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30'
        };
    }
});
</script>

<template>
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="$emit('close')">
        
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden transform transition-all border border-white/10">
            
            <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 class="font-bold text-base text-gray-900">История проектов</h3>
                <button @click="$emit('close')" class="text-gray-400 hover:text-black transition-colors p-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-3 custom-scroll bg-white relative max-h-[360px] min-h-[150px]">
                
                <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <div class="flex flex-col items-center gap-2">
                        <span class="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin"></span>
                        <span class="text-gray-400 font-bold text-[10px] uppercase">Загрузка...</span>
                    </div>
                </div>
                
                <div v-else-if="error" class="text-center py-8 text-red-500 text-xs font-medium px-4">
                    {{ error }}
                </div>

                <div v-else-if="projects.length === 0" class="text-center py-10">
                    <p class="text-gray-400 text-xs">История пуста</p>
                </div>

                <div v-else class="space-y-2">
                    <div v-for="p in projects" :key="p.id" 
                         class="group p-3 border border-gray-100 rounded-xl hover:border-gray-300 transition-all bg-white hover:shadow-sm">
                        
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1 min-w-0 mr-2">
                                <div class="font-bold text-sm text-[#18181B] truncate" :title="p.name">{{ p.name }}</div>
                                <div class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                                    <span>{{ p.date.split(',')[0] }}</span>
                                    <span class="w-0.5 h-0.5 rounded-full bg-gray-300"></span>
                                    <span class="font-bold text-black">{{ parseInt(p.total).toLocaleString() }} ₽</span>
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2">
                            <button @click="requestLoad(p)" class="flex-1 h-7 flex items-center justify-center bg-black text-white hover:bg-gray-800 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors">
                                Загрузить
                            </button>
                            
                            <button @click.stop="requestDelete(p)" class="h-7 px-3 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border border-red-100/50">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-3 bg-gray-50 border-t border-gray-100 z-20">
                <div class="flex gap-2 items-center">
                    <input v-model="projectName" placeholder="Название проекта..." class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 outline-none focus:border-black transition-colors h-8 text-xs font-bold bg-white" @keyup.enter="handleSave">
                    
                    <button @click="handleSave" :disabled="isSaving" class="bg-black text-white px-4 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-gray-800 disabled:opacity-50 h-8 transition-colors shrink-0">
                        {{ isSaving ? '...' : 'Сохранить' }}
                    </button>
                </div>
                <p class="text-[9px] text-gray-400 mt-1.5 text-center">
                    Хранится до 20 последних проектов
                </p>
            </div>
        </div>

        <Teleport to="body">
            <Transition name="modal-pop">
                <div v-if="confirmModal.show" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="closeConfirm">
                    <div class="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-white/50 text-center transform transition-all">
                        
                        <h3 class="text-lg font-black mb-2">{{ modalContent.title }}</h3>
                        <p class="text-sm text-gray-500 mb-6 leading-relaxed">
                            {{ modalContent.text }}
                        </p>
                        
                        <div class="grid grid-cols-2 gap-3">
                            <button @click="closeConfirm" class="py-3 rounded-xl font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider">
                                Отмена
                            </button>
                            <button @click="executeAction" :class="['py-3 rounded-xl font-bold shadow-lg transition-all text-xs uppercase tracking-wider', modalContent.btnClass]">
                                {{ modalContent.btnText }}
                            </button>
                        </div>

                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
/* Анимация для модалки подтверждения */
.modal-pop-enter-active, .modal-pop-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.modal-pop-enter-from, .modal-pop-leave-to { opacity: 0; transform: scale(0.95); }
</style>