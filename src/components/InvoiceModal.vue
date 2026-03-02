<script setup>
import { computed, ref, watch } from 'vue';
import { isCoatingAllowedForMaterial } from '@/utils/coatingCompatibility';

const props = defineProps({
    show: Boolean,
    project: Object,
    layers: Array,
    processing: Array,
    accessories: Array,
    packaging: Array,
    design: Array,
    totals: Object,
    settings: Object,
    materials: Array,
    coatings: Array
});

// Добавляем 'print' в список событий
const emit = defineEmits(['close', 'print']);

const currentDate = new Date().toLocaleDateString('ru-RU');
const invoiceNumber = ref(1932);

watch(() => props.show, (newVal) => {
    if (newVal) {
        const stored = localStorage.getItem('monocalc_invoice_counter');
        let nextNum = stored ? parseInt(stored) + 1 : 1932;
        invoiceNumber.value = nextNum;
        localStorage.setItem('monocalc_invoice_counter', nextNum);
    }
});

const calculateLayerPrice = (layer) => {
    if (!props.materials || !props.settings) return 0;
    
    const m = props.materials.find(x => x.id === layer.matId) || props.materials[0];
    if (!layer.matId || !m) return 0;

    const toNum = (v, fallback = 0) => {
        const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
        return Number.isFinite(n) ? n : fallback;
    };
    const nonNeg = (n) => Math.max(0, n);
    const positive = (n) => (n > 0 ? n : 0);
    const qtySafe = (q) => {
        const n = toNum(q, 1);
        return Number.isFinite(n) && n > 0 ? n : 1;
    };

    const sheetW = positive(toNum(m.sheetW, 0));
    const sheetH = positive(toNum(m.sheetH, 0));
    const sheetPrice = nonNeg(toNum(m.sheetPrice, 0));
    const sheetAreaCm2 = (sheetW / 10) * (sheetH / 10);
    const pricePerCm2 = sheetAreaCm2 > 0 ? (sheetPrice / sheetAreaCm2) : 0;
    const w = positive(toNum(layer.w, 0));
    const h = positive(toNum(layer.h, 0));
    const areaInput = positive(toNum(layer.area, 0));
    const currentArea = areaInput > 0 ? areaInput : (w > 0 && h > 0 ? (Math.round((w * h) / 100 * 10) / 10) : 0);
    const qty = qtySafe(layer.qty);
    const matCost = currentArea * pricePerCm2 * nonNeg(toNum(props.settings.wastage, 1));

    const speed = toNum(m.speed, 1) > 0 ? toNum(m.speed, 1) : 1;
    const cutLengthMm = nonNeg(toNum(layer.cut, 0));
    const cutCost = (cutLengthMm / speed / 60) * nonNeg(toNum(props.settings.laserMinuteCost, 0));

    const engravingPricePerCm2 = (() => {
        const directCm2 = toNum(props.settings.engravingPrice, NaN);
        if (Number.isFinite(directCm2)) return nonNeg(directCm2);
        const legacyBlock = nonNeg(toNum(props.settings.engravingCost100x100mm, 0));
        return legacyBlock / 100;
    })();
    const engravingAreaCm2ByDims = (positive(toNum(layer.engravingW_mm, 0)) * positive(toNum(layer.engravingH_mm, 0))) / 100;
    const engravingAreaCm2 = engravingAreaCm2ByDims > 0
        ? engravingAreaCm2ByDims
        : positive(toNum(layer.engravingArea, 0));
    const engrCost = layer.hasEngraving ? engravingAreaCm2 * engravingPricePerCm2 : 0;

    let finishCost = 0;
    if (layer.finishing !== 'none') {
        const coat = props.coatings.find(c => c.id === layer.finishing);
        if (coat && isCoatingAllowedForMaterial(coat, m)) {
            const finishingMultiplier = layer.finishingBothSides ? 2 : 1;
            finishCost = currentArea * nonNeg(toNum(coat.price, 0)) * finishingMultiplier;
        }
    }

    return (matCost + cutCost + engrCost + finishCost) * qty;
};

const allItems = computed(() => {
    const list = [];
    let idx = 1;

    props.layers.forEach(l => {
        const calculatedTotal = calculateLayerPrice(l);
        if (calculatedTotal <= 0) return;

        const descParts = [];
        if (l.w && l.h) descParts.push(`${l.w}x${l.h} мм`);
        if (l.area) descParts.push(`${l.area} см²`);
        
        list.push({
            id: idx++,
            name: l.name || 'Изделие из листового материала',
            desc: descParts.join(', '),
            category: 'Материал',
            qty: l.qty,
            total: calculatedTotal
        });
    });

    const baseForPercent = Number(props?.totals?.layers || 0);
    const calcListItemTotal = (item) => {
        const toNum = (v, fallback = 0) => {
            const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
            return Number.isFinite(n) ? n : fallback;
        };
        const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
        const nonNeg = (n) => Math.max(0, n);
        const positive = (n) => (n > 0 ? n : 0);
        const qtySafe = (q) => {
            const n = toNum(q, 1);
            return Number.isFinite(n) && n > 0 ? n : 1;
        };

        const val = nonNeg(toNum(item?.value, 0));
        const price = nonNeg(toNum(item?.price, 0));
        const qty = qtySafe(item?.qty);
        const w = positive(toNum(item?.w, 0));
        const h = positive(toNum(item?.h, 0));
        const length = nonNeg(toNum(item?.length, 0));

        if (item?.type === 'percent') return baseForPercent * (clamp(val, 0, 100) / 100);
        if (item?.type === 'linear' || item?.type === 'roll') return price * (length / 1000) * qty;
        if (item?.type === 'linear_mm') return price * length * qty;
        if (item?.type === 'area') return price * ((w * h) / 1000000) * qty;
        if (item?.type === 'area_mm2') return price * (w * h) * qty;
        if (val > 0) return val;
        if (price > 0) return price * qty;
        return 0;
    };

    props.processing.forEach(p => {
        let displayTotal = calcListItemTotal(p);

        if (displayTotal > 0) {
            list.push({
                id: idx++,
                name: p.name,
                desc: p.type === 'fixed' ? 'Услуга' : '',
                category: 'Услуга',
                qty: p.qty,
                total: displayTotal
            });
        }
    });

    props.accessories.forEach(a => {
        const total = calcListItemTotal(a);
        if (total > 0) {
            list.push({ id: idx++, name: a.name, desc: 'Фурнитура', category: 'Товар', qty: a.qty, total: total });
        }
    });

    props.packaging.forEach(p => {
        const total = calcListItemTotal(p);
        if (total > 0) {
            list.push({ id: idx++, name: p.name, desc: 'Упаковка', category: 'Товар', qty: p.qty, total: total });
        }
    });

    props.design.forEach(d => {
        const total = calcListItemTotal(d);
        if (total > 0) {
            list.push({ id: idx++, name: d.name, desc: 'Разработка макета', category: 'Услуга', qty: d.qty || 1, total });
        }
    });

    return list;
});

// ИЗМЕНЕНО: Сначала эмитим событие, потом печатаем
const printInvoice = () => {
    emit('print'); // Trigger auto-save in parent
    
    // Небольшая задержка, чтобы UI успел обновиться (если нужно),
    // хотя window.print блокирует поток, так что событие уйдет до открытия диалога
    setTimeout(() => {
        window.print();
    }, 100);
};
</script>

<template>
    <div v-if="show" class="invoice-modal fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex flex-col items-center overflow-y-auto p-4 md:p-8 text-[#18181B]" @click.self="$emit('close')">
        
        <div class="w-full max-w-[210mm] flex flex-col relative min-h-full">
            
            <div class="flex justify-end gap-3 mb-6 no-print shrink-0">
                <button @click="printInvoice" class="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-gray-100 transition-all flex items-center gap-2 active:scale-95">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Печать / Сохранить PDF
                </button>
                <button @click="$emit('close')" class="bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-all active:scale-95 backdrop-blur-md">
                    Закрыть
                </button>
            </div>

            <div class="bg-white w-full min-h-[297mm] shadow-2xl relative flex flex-col flex-1 animate-slide-up print:shadow-none print:w-full print:absolute print:inset-0 print:h-auto">
                <div class="p-12 pb-8 border-b border-gray-100 flex justify-between items-start">
                    <div><h1 class="text-3xl font-black tracking-tight text-black mb-2">by Pechatny Dvor</h1></div>
                    <div class="text-right"><div class="text-2xl font-bold text-black mb-1">КП № {{ invoiceNumber }}</div><div class="text-sm text-gray-500 font-medium">от {{ currentDate }}</div></div>
                </div>
                <div class="px-12 py-8 flex justify-between gap-12">
                    <div class="flex-1"><div v-if="project.client || project.name"><h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Заказчик</h3><div v-if="project.client" class="text-lg font-bold text-black mb-1">{{ project.client }}</div><div v-if="project.name" class="text-sm text-gray-500">{{ project.name }}</div></div></div>
                    <div class="text-right flex-1"><h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Исполнитель</h3><div class="text-sm font-bold text-black">"Печатный двор"</div><div class="text-sm text-gray-500 mt-1">г. Биробиджан, ул. Советская 60А</div><div class="text-sm text-gray-500 font-medium mt-1">+7 (924) 742-07-76</div></div>
                </div>
                <div class="px-12 py-4 flex-1">
                    <table class="w-full text-left border-collapse">
                        <thead><tr class="border-b-2 border-black"><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black w-10">#</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black">Наименование</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black w-24">Тип</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black text-center w-16">Кол-во</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black text-right w-28">Сумма</th></tr></thead>
                        <tbody class="text-sm text-gray-700">
                            <tr v-for="item in allItems" :key="item.id" class="border-b border-gray-100 last:border-0"><td class="py-4 text-gray-400 font-medium text-xs">{{ item.id }}</td><td class="py-4 font-bold text-black">{{ item.name }}<div class="text-xs text-gray-400 font-normal mt-0.5">{{ item.desc }}</div></td><td class="py-4 text-xs font-medium text-gray-500">{{ item.category }}</td><td class="py-4 text-center font-bold text-black">{{ item.qty }}</td><td class="py-4 text-right font-bold tabular-nums text-black">{{ Math.round(item.total).toLocaleString() }} ₽</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="bg-gray-50 p-12 mt-auto break-inside-avoid">
                    <div class="flex justify-end mb-6"><div class="w-64 space-y-3"><div v-if="totals.markupRub > 0" class="flex justify-between text-sm text-gray-600"><span>Наценка ({{ project.markup }}%):</span><span class="font-bold">+{{ totals.markupRub.toLocaleString() }} ₽</span></div><div v-if="totals.discountRub > 0" class="flex justify-between text-sm text-gray-600"><span>Скидка ({{ project.discount }}%):</span><span class="font-bold">-{{ totals.discountRub.toLocaleString() }} ₽</span></div><div class="flex justify-between items-baseline pt-4 border-t border-gray-200"><span class="text-base font-black uppercase tracking-widest text-black">Итого:</span><span class="text-3xl font-black tracking-tighter text-black">{{ totals.total.toLocaleString() }} ₽</span></div></div></div>
                    <div class="flex justify-between items-end pt-8 border-t border-gray-200"><div class="text-[10px] text-gray-400 max-w-xs leading-relaxed">Предложение действительно в течение 3 рабочих дней.<br>Не является публичной офертой.</div><div class="text-right"><div class="h-10 w-40 border-b border-black mb-2"></div><div class="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Менеджер</div></div></div>
                </div>
            </div>
            
            <div class="h-12 shrink-0 no-print"></div>
        </div>
    </div>
</template>

<style scoped>
/* СТИЛИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ */
.animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

@media print {
    body > *:not(.invoice-modal) { display: none !important; }
    .invoice-modal { 
        visibility: visible !important;
        position: absolute !important; 
        inset: 0 !important; 
        background: white !important; 
        padding: 0 !important; 
        overflow: visible !important;
        display: block !important;
        z-index: 99999 !important;
        height: auto !important;
    }
    .invoice-modal * { visibility: visible !important; }
    .bg-white { box-shadow: none !important; width: 100% !important; max-width: none !important; height: auto !important; margin: 0 !important; }
    .no-print { display: none !important; }
    @page { margin: 0; size: auto; }
}
</style>