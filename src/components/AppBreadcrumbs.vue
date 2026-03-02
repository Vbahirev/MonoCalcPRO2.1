<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCalculator } from '@/core/calculators/registry';

const route = useRoute();
const router = useRouter();

const breadcrumbs = computed(() => {
    const matched = route.matched;
    const crumbs = [];

    // Всегда добавляем "Домой"
    crumbs.push({ label: 'Меню', path: '/', active: route.path === '/' });

    // Калькулятор (новый роут /calc/:id) + поддержка старого /laser
    if (route.path.startsWith('/calc/')) {
        const id = route.params.id;
        const calc = getCalculator(id);
        crumbs.push({ label: calc.manifest.name, path: `/calc/${calc.manifest.id}`, active: route.name === 'calculator' });
    } else if (route.path.includes('/laser')) {
        const calc = getCalculator('laser');
        crumbs.push({ label: calc.manifest.name, path: '/calc/laser', active: true });
    }
    
    // Если мы в настройках
    if (route.path.includes('/settings')) {
        crumbs.push({ label: 'Настройки', path: '/settings', active: true });
    }

    return crumbs;
});

const navigate = (path) => {
    router.push(path);
};
</script>

<template>
    <nav class="flex items-center text-sm font-medium text-gray-500 mb-4 no-print overflow-x-auto whitespace-nowrap py-2">
        <div v-for="(crumb, index) in breadcrumbs" :key="crumb.path" class="flex items-center">
            
            <div v-if="index > 0" class="mx-2 text-gray-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            <button 
                @click="navigate(crumb.path)"
                class="transition-colors rounded-lg px-2 py-1"
                :class="crumb.active ? 'text-black font-black bg-gray-100 cursor-default' : 'hover:text-black hover:bg-gray-50'"
                :disabled="crumb.active"
            >
                {{ crumb.label }}
            </button>
        </div>
    </nav>
</template>