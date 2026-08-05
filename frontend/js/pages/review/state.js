/**
 * pages/review/state.js - centralized state + category helpers
 * Extracted from review.js monolith.
 * This file MUST load before all other review modules.
 */

// ===== STATE (global for backward compat) =====
let currentProject = null;
let currentPageIndex = 0;
let selectedBlockIndex = -1;
let multiSelectedBlocks = new Set();
let activeEditingIndex = -1;
let cropZoom = 1.0;
const CROP_MIN = 0.4, CROP_MAX = 8.0;
let scaleRatioX = 1, scaleRatioY = 1;

let cropPanX = 0, cropPanY = 0;
let isDraggingCrop = false;
let cropDragStartX = 0, cropDragStartY = 0;
let dragSrcIndex = null;

try { document.execCommand('styleWithCSS', false, true); } catch (e) {}

// ===== CATEGORIES =====
const BASE_CATEGORIES = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Picture':'#2c3e50','Section-header':'#1abc9c','Table':'#d35400',
    'Text':'#2ecc71','Title':'#c0392b'
};

function getCategoryColors() {
    return { ...BASE_CATEGORIES, ...(window.__appSettings?.customCategories || {}) };
}

const CATEGORY_ARABIC_MAP = {
    'Text': 'نص عادي',
    'Table': 'جدول',
    'Title': 'عنوان رئيسي',
    'Section-header': 'عنوان فرعي',
    'Picture': 'صورة / رسم',
    'Caption': 'تسمية توضيحية',
    'List-item': 'عنصر قائمة',
    'Footnote': 'حاشية سفلية',
    'Page-header': 'رأس الصفحة',
    'Page-footer': 'تذييل الصفحة',
    'Formula': 'معادلة رياضية'
};

function getCategoryNameAR(catName) {
    return CATEGORY_ARABIC_MAP[catName] || catName;
}

function getAllCategories() {
    return Object.keys(getCategoryColors());
}

function isTableLike(category) {
    return category === 'Table' || category === 'شعر عمودي';
}

// ===== STRUCTURED STORE for new code =====
const ReviewState = {
    project: null,
    pageIndex: 0,
    selectedBlock: -1,
    multiSelected: new Set(),
    activeEditing: -1,
    cropZoom: 1.0,
    scaleRatioX: 1,
    scaleRatioY: 1,
};

function syncFromLegacy() {
    ReviewState.project = currentProject;
    ReviewState.pageIndex = currentPageIndex;
    ReviewState.selectedBlock = selectedBlockIndex;
    ReviewState.multiSelected = multiSelectedBlocks;
    ReviewState.activeEditing = activeEditingIndex;
    ReviewState.cropZoom = cropZoom;
    ReviewState.scaleRatioX = scaleRatioX;
    ReviewState.scaleRatioY = scaleRatioY;
}
function syncToLegacy() {
    currentProject = ReviewState.project;
    currentPageIndex = ReviewState.pageIndex;
    selectedBlockIndex = ReviewState.selectedBlock;
    multiSelectedBlocks = ReviewState.multiSelected;
    activeEditingIndex = ReviewState.activeEditing;
    cropZoom = ReviewState.cropZoom;
    scaleRatioX = ReviewState.scaleRatioX;
    scaleRatioY = ReviewState.scaleRatioY;
}

window.ReviewState = ReviewState;
window.ReviewStateSync = { syncFromLegacy, syncToLegacy };

// Also expose categories globally for legacy code that expects them
window.getCategoryColors = getCategoryColors;
window.getCategoryNameAR = getCategoryNameAR;
window.getAllCategories = getAllCategories;
window.isTableLike = isTableLike;
window.BASE_CATEGORIES = BASE_CATEGORIES;
window.CATEGORY_ARABIC_MAP = CATEGORY_ARABIC_MAP;
