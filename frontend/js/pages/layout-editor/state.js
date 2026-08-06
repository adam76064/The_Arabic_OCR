/**
 * pages/layout-editor/state.js - state management for layout editor
 * Extracted from layout-editor.js monolith
 */
let currentProject = null;
let currentPageIndex = 0;
let ocrData = [];
let scaleRatioX = 1, scaleRatioY = 1;

let resizeStartTs = null;
let isMarqueeSelecting = false;
let marqueeStartX = 0, marqueeStartY = 0;

let currentTool = 'select';
let selectedBoxes = new Set();
let nextOrderSequence = 1;

let isDrawing = false;
let isResizing = false;
let isMoving = false;
let resizeHandle = null;
let resizeStartBbox = null;
let moveStartBboxes = [];
let drawStartX = 0, drawStartY = 0;
let currentMouseX = 0, currentMouseY = 0;
let activeBoxIdx = -1;

let selectedTableCells = { blockIdx: null, cellIndices: [] };
let isDraggingTableLine = false;

const BASE_CATEGORIES = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Picture':'#2c3e50','Section-header':'#1abc9c','Table':'#d35400',
    'Text':'#2ecc71','Title':'#c0392b', 'Page-number':'#0984e3',
    'Vertical-poetry':'#e84393', 'Staggered-poetry':'#00cec9'
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
    'Formula': 'معادلة رياضية',
    'Page-number': 'رقم الصفحة',
    'Vertical-poetry': 'شعر عمودي',
    'Staggered-poetry': 'شعر متدرج'
};

function getCategoryNameAR(catName) {
    return CATEGORY_ARABIC_MAP[catName] || catName;
}

function getAllCategories() {
    return Object.keys(getCategoryColors());
}

function isTableLike(category) {
    return category === 'Table' || category === 'Vertical-poetry';
}

window.getCategoryColors = getCategoryColors;
window.getCategoryNameAR = getCategoryNameAR;
window.getAllCategories = getAllCategories;
window.isTableLike = isTableLike;
