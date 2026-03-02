<script setup>
import { ref } from 'vue';
import { auth } from '@/services/firebase';
import { 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup 
} from 'firebase/auth';

const emit = defineEmits(['close', 'success']);

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMsg = ref('');

// Универсальная функция входа
const performLogin = async (method) => {
    isLoading.value = true;
    errorMsg.value = '';
    try {
        await method();
        // Если вход успешен — просто сообщаем наверх
        emit('success');
        emit('close');
    } catch (e) {
        if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
             errorMsg.value = 'Неверный email или пароль';
        } else if (e.code === 'auth/popup-closed-by-user') {
             errorMsg.value = ''; // Пользователь просто закрыл окно
        } else {
             errorMsg.value = 'Ошибка входа: ' + e.message;
        }
    } finally {
        isLoading.value = false;
    }
};

const handleLogin = async () => {
    if (!email.value || !password.value) return;
    performLogin(() => signInWithEmailAndPassword(auth, email.value, password.value));
};

const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    performLogin(() => signInWithPopup(auth, provider));
};
</script>

<template>
    <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="$emit('close')">
        <div class="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl shadow-2xl p-6 overflow-hidden transform transition-all animate-pop-in border border-white/10">
            
            <button @click="$emit('close')" class="absolute top-4 right-4 p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div class="text-center mb-6 mt-2">
                <h2 class="text-2xl font-black text-[#1d1d1f] dark:text-white tracking-tight">Вход</h2>
                <p class="text-xs text-gray-500 font-medium mt-1">Для сохранения проектов</p>
            </div>

            <div class="space-y-3">
                <button @click="handleGoogleLogin" :disabled="isLoading" class="w-full h-12 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors active:scale-[0.98]">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" />
                    <span>Войти через Google</span>
                </button>

                <div class="relative py-2"><div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200 dark:border-white/10"></div></div><div class="relative flex justify-center"><span class="bg-white dark:bg-[#1C1C1E] px-2 text-[10px] text-gray-400 uppercase font-bold">или email</span></div></div>

                <form @submit.prevent="handleLogin" class="space-y-3">
                    <input v-model="email" type="email" placeholder="Email" class="w-full h-12 px-4 rounded-xl bg-gray-100 dark:bg-white/5 border-none outline-none text-sm font-bold dark:text-white focus:ring-2 ring-black/10 dark:ring-white/10 transition-all">
                    <input v-model="password" type="password" placeholder="Пароль" class="w-full h-12 px-4 rounded-xl bg-gray-100 dark:bg-white/5 border-none outline-none text-sm font-bold dark:text-white focus:ring-2 ring-black/10 dark:ring-white/10 transition-all">
                    <button type="submit" :disabled="isLoading" class="w-full h-12 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs uppercase hover:opacity-90 active:scale-[0.98] transition-all shadow-lg">
                        {{ isLoading ? 'Вход...' : 'Войти' }}
                    </button>
                </form>

                <p v-if="errorMsg" class="text-xs text-red-500 text-center font-bold mt-2 bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">{{ errorMsg }}</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-pop-in { animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes popIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
</style>