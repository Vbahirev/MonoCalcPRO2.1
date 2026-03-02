import { ref, onMounted, onUnmounted } from 'vue';

// Современный и производительный детектор: matchMedia вместо resize.
// Важно: порог оставляем прежним (1024px), чтобы НЕ менять визуал/логику.
const MOBILE_QUERY = '(max-width: 1023.98px)';

export function useDevice() {
    const isMobile = ref(false);

    /** @type {MediaQueryList | null} */
    let mql = null;

    const sync = () => {
        // На всякий случай не падаем при SSR/тестах.
        if (typeof window === 'undefined') return;
        isMobile.value = mql ? mql.matches : window.innerWidth < 1024;
    };

    const onChange = () => sync();

    onMounted(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            // Fallback для очень старых окружений.
            sync();
            return;
        }

        mql = window.matchMedia(MOBILE_QUERY);
        sync();

        // Современный API
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', onChange);
        } else if (typeof mql.addListener === 'function') {
            // Safari/старые браузеры
            mql.addListener(onChange);
        }
    });

    onUnmounted(() => {
        if (!mql) return;

        if (typeof mql.removeEventListener === 'function') {
            mql.removeEventListener('change', onChange);
        } else if (typeof mql.removeListener === 'function') {
            mql.removeListener(onChange);
        }
        mql = null;
    });

    return { isMobile };
}