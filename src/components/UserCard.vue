
<template>
  <div
    class="bg-white dark:bg-[#1C1C1E] rounded-2xl p-5 shadow-sm
           hover:shadow-md transition cursor-grab select-none"
  >
    <div class="flex items-center gap-3">
      <img
        :src="avatar || defaultAvatar"
        class="w-10 h-10 rounded-full object-cover"
      />
      <div class="min-w-0">
        <div class="font-semibold text-[15px] truncate">
          {{ name }}
        </div>
        <div class="text-[12px] opacity-60 truncate">
          {{ email }}
        </div>
      </div>
    </div>

    <div class="mt-3">
      <div class="text-[11px] uppercase tracking-wide opacity-50 mb-1">
        Права доступа
      </div>

      <div v-if="permissions?.length" class="text-[13px] space-y-1 leading-snug">
        <div
          v-for="p in visiblePermissions"
          :key="p"
          class="truncate"
        >
          {{ p }}
        </div>
        <div
          v-if="permissions.length > limit"
          class="opacity-50 text-[12px]"
        >
          + ещё {{ permissions.length - limit }}
        </div>
      </div>

      <div v-else class="text-[13px] opacity-40">
        нет активных прав
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: String,
  email: String,
  avatar: String,
  permissions: Array,
  limit: { type: Number, default: 3 },
});

const defaultAvatar =
  'https://ui-avatars.com/api/?background=ddd&color=555';

const visiblePermissions = computed(() =>
  props.permissions?.slice(0, props.limit)
);
</script>
