import { ref, onUnmounted } from 'vue';

// Глобальное состояние скролла
const scrollElement = ref(null);
const listeners = new Set();

export function useGlobalScroll() {
    
    // Регистрация контейнера (вызывается в App.vue)
    const registerScrollContainer = (el) => {
        scrollElement.value = el;
    };

    // Вызов всех слушателей (вызывается в App.vue при скролле)
    const triggerScroll = (event) => {
        listeners.forEach(callback => callback(event));
    };

    // Подписка на скролл (вызывается в компонентах, которым это нужно)
    const onGlobalScroll = (callback) => {
        listeners.add(callback);
        onUnmounted(() => {
            listeners.delete(callback);
        });
    };

    // Метод для прокрутки (например, "перейти к разделу")
    const scrollTo = (options) => {
        if (scrollElement.value) {
            scrollElement.value.scrollTo(options);
        }
    };

    return {
        registerScrollContainer,
        triggerScroll,
        onGlobalScroll,
        scrollTo,
        scrollElement
    };
}