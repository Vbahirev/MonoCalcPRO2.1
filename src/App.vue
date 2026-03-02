<script setup>
import { onMounted } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useDatabase } from '@/composables/useDatabase';

// Достаем методы инициализации
const { initTheme } = useTheme();
const { initDatabase: initDB } = useDatabase();

onMounted(() => {
    // 1. Применяем сохраненную тему (Светлая / Тёмная / Системная)
    initTheme();

    // 2. Инициализируем подключение к базе и слушатель авторизации
    initDB();
});
</script>

<template>
  <router-view />
</template>

<style>
/* --- ГЛОБАЛЬНЫЕ СТИЛИ --- */

/* Настройки для HTML */
html {
  height: 100%;
  background-color: #F5F5F7; /* Фон по умолчанию (светлый) */
  transition: none; /* Без флика на первом кадре */
}

html.theme-ready {
  transition: background-color 0.2s ease; /* Плавная смена после инициализации */
}

/* Настройки для HTML в темной теме */
html.dark {
  background-color: #121212; /* Фон по умолчанию (темный) */
}

/* Настройки Body */
body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  background-color: inherit; /* Наследует цвет от html */
  color: #1d1d1f; /* Цвет текста по умолчанию */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Цвет текста в темной теме */
html.dark body {
  color: #ffffff;
}

/* Убираем синюю подсветку при нажатии на мобильных (iOS/Android) */
* {
  -webkit-tap-highlight-color: transparent;
}

/* Кастомный скроллбар (тонкий и аккуратный) */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

html.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

html.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>