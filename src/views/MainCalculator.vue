<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDevice } from '@/composables/useDevice';
import MobileApp from '@/components/MobileApp.vue';
import DesktopApp from '@/components/DesktopApp.vue';

const { isMobile } = useDevice();
const router = useRouter();
const route = useRoute();

const calculatorId = computed(() => route.params.id || 'laser');

const goBack = () => {
    router.push('/');
};
</script>

<template>
    <div class="relative min-h-screen bg-white dark:bg-[#121212] transition-colors duration-300">
        <MobileApp v-if="isMobile" :calculator-id="calculatorId" @go-home="goBack" />
        <DesktopApp v-else :calculator-id="calculatorId" />
    </div>
</template>