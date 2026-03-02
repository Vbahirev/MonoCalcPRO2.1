<script setup>
import { computed } from 'vue';

const props = defineProps({
    name: String,
    active: Boolean
});

// CSS классы для анимации при active = true
const animationClass = computed(() => props.active ? 'animate-active' : 'text-gray-400');
</script>

<template>
    <div class="relative w-6 h-6 flex items-center justify-center transition-colors duration-500" 
         :class="active ? 'text-black' : 'text-gray-400'">
        
        <svg v-if="name === 'layers'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full overflow-visible">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                  class="transition-all duration-500 origin-center"
                  :class="active ? 'translate-y-[-2px] drop-shadow-md' : ''" />
        </svg>

        <svg v-if="name === 'processing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                  class="origin-center transition-transform duration-1000"
                  :class="active ? 'rotate-90' : ''" />
        </svg>

        <svg v-if="name === 'accessories'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
            <path d="M12 2l9 4.9V17L12 22l-9-4.9V7z" 
                  class="transition-all duration-300 origin-center"
                  :class="active ? 'scale-110 fill-black/10' : ''" />
        </svg>

        <svg v-if="name === 'packaging'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" class="transition-all duration-500" :class="active ? 'translate-y-[-2px]' : ''"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12" class="transition-all duration-500" :class="active ? 'scale-y-110' : ''"></line>
        </svg>

        <svg v-if="name === 'design'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
                  class="transition-transform duration-500 origin-bottom-left"
                  :class="active ? '-rotate-12 translate-x-1' : ''"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
        </svg>

        <svg v-if="name === 'total'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">
            <rect x="4" y="2" width="16" height="20" rx="2" 
                  class="transition-all duration-300"
                  :class="active ? 'fill-black stroke-black' : ''"></rect>
            <line x1="12" y1="18" x2="12" y2="18" stroke-width="2" :class="active ? 'stroke-white' : ''"></line>
            <line x1="8" y1="18" x2="8" y2="18" stroke-width="2" :class="active ? 'stroke-white' : ''"></line>
            <line x1="16" y1="18" x2="16" y2="18" stroke-width="2" :class="active ? 'stroke-white' : ''"></line>
            <line x1="8" y1="14" x2="16" y2="14" :class="active ? 'stroke-white' : ''"></line>
            <path d="M8 6h8v4H8z" :class="active ? 'stroke-white' : ''"></path>
        </svg>
    </div>
</template>