<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['scroll', 'register']);
const scrollRef = ref(null);
const showScrollTop = ref(false);

const onScroll = (e) => {
  emit('scroll', e);
  showScrollTop.value = e.target.scrollTop > 300;
};

const scrollToTop = () => {
  if (scrollRef.value) {
    scrollRef.value.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

onMounted(() => {
  if (scrollRef.value) {
    emit('register', scrollRef.value);
  }
});
</script>

<template>
  <div ref="scrollRef" class="page-scroll" @scroll="onScroll">
    <slot />

    <Transition name="pop-up">
      <div 
        v-if="showScrollTop"
        class="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 w-20 h-12 flex items-center justify-center group cursor-pointer"
        @click="scrollToTop"
      >
        <div class="h-12 bg-[#1d1d1f] dark:bg-white shadow-2xl backdrop-blur-md border border-white/10 dark:border-black/10 rounded-full btn-bouncy"></div>

        <svg 
          width="24" height="24" viewBox="0 0 24 24" 
          fill="none" stroke="currentColor" stroke-width="2.5" 
          stroke-linecap="round" stroke-linejoin="round"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white dark:text-black pointer-events-none z-10"
        >
            <path d="M18 15l-6-6-6 6"/>
        </svg>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page-scroll {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

/* ФИЗИКА ВОЗВРАТА (РАСТЯЖЕНИЕ) */
.btn-bouncy {
  width: 100%; 
  transform: translateZ(0); 
  will-change: width;

  /* ОБРАТНЫЙ ХОД (Когда убираешь мышь):
     Duration: 0.7s (Быстрее, чем было).
     Bezier: (0.35, 1.6, 0.6, 1) — Значение 1.6 заставляет ширину "вылететь" 
     за пределы 100% (растянуться в длинную сосиску), а потом спружинить назад.
  */
  transition: width 0.7s cubic-bezier(0.35, 1.6, 0.6, 1), 
              background-color 0.3s ease;
}

/* ФИЗИКА АТАКИ (СЖАТИЕ) */
.group:hover .btn-bouncy {
  width: 48px; 

  /* ПРЯМОЙ ХОД (Когда наводишь мышь):
     Оставляем твой любимый "Эллипс" (сплющивание).
  */
  transition: width 0.5s cubic-bezier(0.25, 2.5, 0.5, 1);
}

/* Клик */
.group:active .btn-bouncy {
  transform: scale(0.9) translateZ(0);
  transition: transform 0.1s ease;
}

/* Появление */
.pop-up-enter-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-up-leave-active {
  transition: all 0.3s ease-in;
}

.pop-up-enter-from,
.pop-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 40px) scale(0.5); 
}
</style>