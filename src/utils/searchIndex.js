const RU_TO_EN_MAP = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

const EN_TO_RU_MAP = {
    a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж',
    k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т',
    u: 'у', v: 'в', w: 'в', x: 'кс', y: 'й', z: 'з'
};

export const normalizeSearchValue = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const transliterate = (text, map) => [...text].map(ch => map[ch] ?? ch).join('');

export const getSearchVariants = (query) => {
    const normalized = normalizeSearchValue(query);
    if (!normalized) return [];

    return [...new Set([
        normalized,
        transliterate(normalized, RU_TO_EN_MAP),
        transliterate(normalized, EN_TO_RU_MAP),
    ].map(normalizeSearchValue).filter(Boolean))];
};

export const buildDeepSearchBlob = (source, maxDepth = 3, maxItemsPerLevel = 80) => {
    const parts = [];

    const push = (value) => {
        if (value === null || value === undefined) return;
        if (typeof value === 'number' && Number.isFinite(value)) {
            const rounded = String(Math.round(value));
            parts.push(String(value));
            parts.push(rounded);
            parts.push(rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ' '));
            return;
        }
        if (typeof value === 'boolean') {
            parts.push(value ? 'true' : 'false');
            parts.push(value ? 'да' : 'нет');
            return;
        }
        const text = String(value).trim();
        if (!text) return;
        parts.push(text);
    };

    const collectDeep = (value, depth = 0) => {
        if (value === null || value === undefined || depth > maxDepth) return;
        if (Array.isArray(value)) {
            value.slice(0, maxItemsPerLevel).forEach(v => collectDeep(v, depth + 1));
            return;
        }
        if (typeof value === 'object') {
            Object.entries(value).slice(0, maxItemsPerLevel).forEach(([key, val]) => {
                push(key);
                collectDeep(val, depth + 1);
            });
            return;
        }
        push(value);
    };

    collectDeep(source);
    return normalizeSearchValue(parts.join(' | '));
};

export const matchesSearchBlob = (blob, query) => {
    const variants = getSearchVariants(query);
    if (!variants.length) return true;
    const normalizedBlob = normalizeSearchValue(blob);
    return variants.some(v => normalizedBlob.includes(v));
};

export const matchesSearchQuery = (source, query, maxDepth = 3, maxItemsPerLevel = 80) => {
    const variants = getSearchVariants(query);
    if (!variants.length) return true;
    const blob = buildDeepSearchBlob(source, maxDepth, maxItemsPerLevel);
    return variants.some(v => blob.includes(v));
};