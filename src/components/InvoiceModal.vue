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
    productQty: { type: Number, default: 1 },
    settings: Object,
    materials: Array,
    coatings: Array
});

const safeProductQty = computed(() => {
    const n = Number(props.productQty);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
});
const toMoneyNum = (value) => {
    if (typeof value === 'string') {
        const normalized = value.replace(/\s+/g, '').replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

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

const subTotalOne = computed(() => {
    return Math.round((allItems.value || []).reduce((sum, item) => sum + toMoneyNum(item?.total), 0));
});

const projectMarkupPct = computed(() => {
    const n = toMoneyNum(props?.project?.markup);
    return Math.max(0, n);
});

const projectDiscountPct = computed(() => {
    const n = toMoneyNum(props?.project?.discount);
    return Math.min(100, Math.max(0, n));
});

const markupRubOne = computed(() => Math.round(subTotalOne.value * (projectMarkupPct.value / 100)));
const beforeDiscountOne = computed(() => subTotalOne.value + markupRubOne.value);
const discountRubOne = computed(() => Math.round(beforeDiscountOne.value * (projectDiscountPct.value / 100)));
const pricePerOne = computed(() => Math.max(0, Math.round(beforeDiscountOne.value - discountRubOne.value)));
const totalForAll = computed(() => Math.round(pricePerOne.value * safeProductQty.value));
const formatMoney = (value) => new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(value) || 0));

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
        
        <div class="invoice-root w-full max-w-[210mm] flex flex-col relative min-h-full">
            
            <div class="flex justify-end gap-3 mb-6 no-print shrink-0">
                <button @click="printInvoice" class="bg-white text-black px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:bg-gray-100 transition-all flex items-center gap-2 active:scale-95">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Печать / Сохранить PDF
                </button>
                <button @click="$emit('close')" class="bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-all active:scale-95 backdrop-blur-md">
                    Закрыть
                </button>
            </div>

            <div class="invoice-sheet bg-white w-full min-h-[297mm] shadow-2xl relative flex flex-col animate-slide-up print:shadow-none print:w-full print:h-auto">
                <div class="p-12 pb-8 border-b border-gray-100 flex justify-between items-start">
                    <div><h1 class="text-3xl font-black tracking-tight text-black mb-2">Печатный двор</h1></div>
                    <div class="text-right"><div class="text-2xl font-bold text-black mb-1">КП № {{ invoiceNumber }}</div><div class="text-sm text-gray-500 font-medium">от {{ currentDate }}</div></div>
                </div>
                <div class="px-12 py-8 flex justify-between gap-12">
                    <div class="flex-1"><div v-if="project.client || project.name"><h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Заказчик</h3><div v-if="project.client" class="text-lg font-bold text-black mb-1">{{ project.client }}</div><div v-if="project.name" class="text-sm text-gray-500">{{ project.name }}</div></div></div>
                    <div class="text-right flex-1"><h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Исполнитель</h3><div class="text-sm font-bold text-black">"Печатный двор"</div><div class="text-sm text-gray-500 mt-1">г. Биробиджан, ул. Советская 60А</div><div class="text-sm text-gray-500 font-medium mt-1">+7 (924) 742-07-76</div></div>
                </div>
                <div class="invoice-table-wrap px-12 py-4 flex-1">
                    <table class="w-full text-left border-collapse">
                        <thead><tr class="border-b-2 border-black"><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black w-10">#</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black">Наименование</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black w-24">Тип</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black text-center w-16">Кол-во</th><th class="py-3 text-[10px] font-black uppercase tracking-wider text-black text-right w-28">Сумма</th></tr></thead>
                        <tbody class="text-sm text-gray-700">
                            <tr v-for="item in allItems" :key="item.id" class="border-b border-gray-100 last:border-0"><td class="py-4 text-gray-400 font-medium text-xs">{{ item.id }}</td><td class="py-4 font-bold text-black">{{ item.name }}<div class="text-xs text-gray-400 font-normal mt-0.5">{{ item.desc }}</div></td><td class="py-4 text-xs font-medium text-gray-500">{{ item.category }}</td><td class="py-4 text-center font-bold text-black">{{ item.qty }}</td><td class="py-4 text-right font-bold tabular-nums text-black">{{ (Math.round(item.total ?? 0)).toLocaleString() }} ₽</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="invoice-summary bg-white p-12 mt-auto">
                    <div class="flex justify-end mb-6">
                        <div class="w-64 space-y-3">
                            <div v-if="markupRubOne > 0" class="flex justify-between text-sm text-gray-600">
                                <span>Наценка ({{ project.markup }}%):</span>
                                <span class="font-bold">+{{ (markupRubOne ?? 0).toLocaleString() }} ₽</span>
                            </div>
                            <div v-if="discountRubOne > 0" class="flex justify-between text-sm text-gray-600">
                                <span>Скидка ({{ project.discount }}%):</span>
                                <span class="font-bold">-{{ (discountRubOne ?? 0).toLocaleString() }} ₽</span>
                            </div>
                            <div class="flex justify-between items-center pt-2">
                                <span class="text-xs font-bold text-gray-500">Количество изделий:</span>
                                <span class="font-bold">{{ safeProductQty }} шт</span>
                            </div>
                            <div class="flex justify-between items-center pt-2">
                                <span class="text-xs font-bold text-gray-500">Цена за 1 шт.:</span>
                                <span class="invoice-money-line"><span class="invoice-money-number">{{ formatMoney(pricePerOne) }}</span><span class="invoice-money-currency">₽</span></span>
                            </div>
                            <div class="flex justify-between items-end pt-4 border-t border-gray-200 gap-4">
                                <span class="text-base font-black uppercase tracking-widest text-black">Итого:</span>
                                <span class="invoice-total-line"><span class="invoice-total-number">{{ formatMoney(totalForAll) }}</span><span class="invoice-total-currency">₽</span></span>
                            </div>
                        </div>
                    </div>
                    <div class="invoice-footer flex justify-between items-end pt-8 border-t border-gray-200"><div class="text-[10px] text-gray-400 max-w-xs leading-relaxed">Предложение действительно в течение 3 рабочих дней.<br>Не является публичной офертой.</div><div class="text-right"><div class="h-10 w-40 border-b border-black mb-2"></div><div class="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Менеджер</div></div></div>
                </div>
            </div>
            
            <div class="h-12 shrink-0 no-print"></div>
        </div>
    </div>
</template>

<style>
/* СТИЛИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ */
.animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

.invoice-money-line {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.28rem;
    white-space: nowrap;
    text-align: right;
    font-weight: 800;
    line-height: 1;
}

.invoice-total-line {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.35rem;
    white-space: nowrap;
    text-align: right;
    font-weight: 800;
    color: #000;
    line-height: 1;
    font-size: 2.45rem;
    letter-spacing: -0.02em;
}

.invoice-money-number,
.invoice-total-number {
    font-variant-numeric: tabular-nums;
}

.invoice-money-currency {
    font-size: 0.98em;
}

.invoice-total-currency {
    font-size: 0.94em;
}

@media print {
    html, body {
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
        background: #fff !important;
    }

    body > :not(.invoice-modal) {
        display: none !important;
    }

    .invoice-modal {
        position: static !important;
        inset: auto !important;
        display: block !important;
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        width: auto !important;
        height: auto !important;
        max-height: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .invoice-root {
        width: 100% !important;
        max-width: none !important;
        min-height: 0 !important;
        height: auto !important;
        display: block !important;
    }

    .invoice-sheet {
        box-shadow: none !important;
        background: #fff !important;
        width: 100% !important;
        max-width: none !important;
        height: auto !important;
        min-height: 297mm !important;
        margin: 0 !important;
        position: static !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: visible !important;
    }

    .invoice-table-wrap {
        flex: 1 1 auto !important;
        overflow: visible !important;
    }

    .invoice-summary {
        background: #fff !important;
        margin-top: auto !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
    }

    .invoice-footer {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
    }

    .invoice-table-wrap table {
        width: 100% !important;
        border-collapse: collapse !important;
    }

    .invoice-table-wrap thead {
        display: table-header-group;
    }

    .invoice-table-wrap tr {
        break-inside: avoid;
        page-break-inside: avoid;
    }

    .no-print {
        display: none !important;
    }

    @page {
        size: A4;
        margin: 0;
    }
}
</style>