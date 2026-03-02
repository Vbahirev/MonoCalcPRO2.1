import { ref, computed, watch } from 'vue';

// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
// Храним состояние вне функции, чтобы оно было единым для всего приложения
const THEME_KEY = 'monocalc-theme-preference'; // Ключ для памяти браузера
const theme = ref(localStorage.getItem(THEME_KEY) || 'system'); // Читаем из памяти или ставим system

// Следим за системной темой в реальном времени
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const systemIsDark = ref(mediaQuery.matches);

// Слушатель изменений системы (если ты поменял тему в Windows/iOS, не перезагружая сайт)
mediaQuery.addEventListener('change', (e) => {
    systemIsDark.value = e.matches;
    if (theme.value === 'system') {
        applyTheme();
    }
});

// --- ФУНКЦИЯ ПРИМЕНЕНИЯ ТЕМЫ К HTML ---
const applyTheme = () => {
    const root = document.documentElement;
    const isDark = 
        theme.value === 'dark' || 
        (theme.value === 'system' && systemIsDark.value);

    if (isDark) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

export function useTheme() {
    
    // Функция установки темы (вызывается кнопками)
    const setTheme = (newTheme) => {
        theme.value = newTheme;
        localStorage.setItem(THEME_KEY, newTheme); // <-- СОХРАНЯЕМ В ПАМЯТЬ
        applyTheme();
    };

    // Вычисляемое свойство: "Сейчас темно?" (для иконок луны/солнца)
    const isDark = computed(() => {
        return theme.value === 'dark' || (theme.value === 'system' && systemIsDark.value);
    });

    // Инициализация (нужно вызвать один раз при старте приложения)
    const initTheme = () => {
        applyTheme();
    };

    return {
        theme,
        isDark,
        setTheme,
        initTheme
    };
}