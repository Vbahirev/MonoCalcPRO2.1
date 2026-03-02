<template>
  <div class="modal-backdrop">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      <slot />
      <div class="actions">
        <button @click="$emit('cancel')">Отмена</button>
        <button
          :class="variant"
          :disabled="delay && !armed"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  title: String,
  message: String,
  confirmText: { type: String, default: 'Подтвердить' },
  variant: { type: String, default: 'danger' },
  delay: { type: Boolean, default: false },
});

const armed = ref(!props.delay);

onMounted(() => {
  if (props.delay) {
    setTimeout(() => armed.value = true, 1500);
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--bg-panel);
  padding: 20px;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
button.danger {
  background: #e74c3c;
  color: #fff;
}
</style>