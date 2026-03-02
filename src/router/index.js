import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/LandingPage.vue')
    },
    {
      path: '/calc/laser', // Явный путь для калькулятора лазера
      name: 'calculator-laser',
      component: () => import('../views/MainCalculator.vue')
    },
    // Редиректы для старых ссылок
    { path: '/calc/:id', redirect: to => `/calc/${to.params.id}` }, 
    { path: '/laser', redirect: '/calc/laser' },

    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue')
    },

    // --- НОВАЯ СТРУКТУРА НАСТРОЕК ---
    {
      path: '/settings',
      name: 'settings-hub',
      component: () => import('../views/SettingsHub.vue')
    },
    {
      path: '/settings/laser',
      name: 'settings-laser',
      component: () => import('../views/LaserSettings.vue')
    },
    {
      path: '/settings/trash',
      name: 'settings-trash',
      component: () => import('../views/TrashView.vue')
    },

    // --- Администрирование: структура данных (STEP 1-4) ---
    {
      path: '/admin/data-audit',
      name: 'admin-data-audit',
      component: () => import('../views/AdminDataAudit.vue')
    },
  ]
})

export default router
