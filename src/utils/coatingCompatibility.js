export const MATERIAL_TYPE_CATALOG = [
    { value: 'wood', label: 'Дерево' },
    { value: 'acrylic', label: 'Акрил' },
    { value: 'plastic', label: 'Пластик' },
    { value: 'metal', label: 'Металл' },
    { value: 'cardboard', label: 'Картон' },
    { value: 'glass', label: 'Стекло' },
    { value: 'fabric', label: 'Ткань' },
    { value: 'composite', label: 'Композит' },
    { value: 'other', label: 'Другое' }
];

const MATERIAL_TYPE_LABEL_MAP = MATERIAL_TYPE_CATALOG.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
}, {});

export const normalizeMaterialType = (value) => {
    if (value === null || value === undefined) return 'other';
    const normalized = String(value).trim().toLowerCase();
    return normalized || 'other';
};

export const getMaterialType = (material) => normalizeMaterialType(material?.type);

export const getMaterialTypeLabel = (value) => {
    const normalized = normalizeMaterialType(value);
    return MATERIAL_TYPE_LABEL_MAP[normalized] || 'Другое';
};

export const getCoatingAllowedTypes = (coating) => {
    if (!coating) return ['all'];
    const source = Array.isArray(coating.allowedMaterialTypes)
        ? coating.allowedMaterialTypes
        : coating.allowedMaterialTypes
            ? [coating.allowedMaterialTypes]
            : [];

    const normalized = [...new Set(source.map(normalizeMaterialType))].filter(Boolean);
    return normalized.length ? normalized : ['all'];
};

export const isCoatingAllowedForMaterial = (coating, material) => {
    const allowed = getCoatingAllowedTypes(coating);
    if (allowed.includes('all')) return true;
    return allowed.includes(getMaterialType(material));
};
