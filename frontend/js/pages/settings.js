// Shared settings. window.__appSettings starts with these in-memory
// defaults immediately (synchronously) so any code that reads it right
// away never sees undefined values, then gets asynchronously overlaid
// with whatever was actually persisted to disk via the backend
// (app_settings.json), once pywebview is ready. Listen for the
// 'appSettingsLoaded' event if you need to wait for the persisted values.
window.DEFAULT_LLM_PROMPT = `You are a specialized OCR and document layout extraction engine.

Your task is to extract all text and layout elements from the attached image and return ONLY a single valid JSON object.
All bounding box (bbox) coordinates MUST be normalized on a scale from 0 to 1000.
Where (0,0) is the top-left corner of the image, and (1000,1000) is the bottom-right corner.

VERY IMPORTANT: The coordinate order must strictly be [x_min, y_min, x_max, y_max]. (Never put y_min first).

Rules:
- Return the elements in the correct human reading order.
- Each element must contain:
  - bbox: [x1, y1, x2, y2] (integers from 0 to 1000)
  - category: one of ["Caption","Footnote","Formula","List-item","Page-footer","Page-header","Picture","Section-header","Table","Text","Title"]
  - text: The text content in Arabic, formatted as follows:
    - Picture: leave empty
    - Formula: use LaTeX
    - Table: use HTML
    - All others: use Markdown
- Do not translate. Extract the text exactly as it appears in the image in Arabic.
- Output ONLY the JSON code without any Markdown formatting (e.g., no \`\`\`json) and without any additional explanations.

This is the required structure:
{
  "elements": [
    {
      "bbox": [0, 0, 0, 0],
      "category": "Text",
      "text": "النص هنا..."
    }
  ]
}`;

window.__appSettings = window.__appSettings || {
    theme: 'auto',
    autoMarkReviewed: true,
    autoSaveReview: false, 
    autoSaveLayout: false, 
    showIV: true,
    showCV: true,
    uiZoom: 1.0,
    interfaceLanguage: 'ar',
    blockFontSize: 14,   
    historyLimit: 50,    
    keyboardShortcuts: {}, 
    promptDeletePage: true,
    deletePageFiles: false,
    promptDeleteProject: true,
    deleteProjectFiles: true,
    llmSystemPrompt: window.DEFAULT_LLM_PROMPT,
    customCategories: {
        'Page-number': '#0984e3',
        'Vertical-poetry': '#e84393' // Deep Teal
    }
};

// Registry of every customizable keyboard-shortcut-able action in the
// app. This is metadata only (id/label/category/defaultKey) - actual
// handler functions are wired up separately in review.js, since this
// file is shared by every page (including settings.html, which just
// needs to list/edit shortcuts, not execute them).
window.__KEYBOARD_COMMANDS = [
    { id: 'save-page',           label: 'حفظ الصفحة',                          category: 'page',        defaultKey: 'Ctrl+S' },
    { id: 'prev-page',           label: 'الصفحة السابقة',                       category: 'page',        defaultKey: 'PageUp' },
    { id: 'next-page',           label: 'الصفحة التالية',                       category: 'page',        defaultKey: 'PageDown' },
    { id: 'load-ocr-page',       label: 'تحميل صفحة OCR',                       category: 'page',        defaultKey: 'Ctrl+O' },
    { id: 'open-fullpage',       label: 'عرض الصفحة بالحجم الكامل',              category: 'page',        defaultKey: 'Ctrl+Shift+F' },
    { id: 'toggle-sidebar',      label: 'إظهار/إخفاء الشريط الجانبي',            category: 'page',        defaultKey: 'Ctrl+Shift+B' },
    { id: 'project-settings',    label: 'إعدادات المشروع',                       category: 'page',        defaultKey: 'Ctrl+Shift+S' },

    { id: 'undo',                label: 'تراجع',                                category: 'history', defaultKey: 'Ctrl+Z' },
    { id: 'redo',                label: 'إعادة',                                category: 'history', defaultKey: 'Ctrl+Y' },

    { id: 'export',              label: 'تصدير المشروع',                        category: 'tools',          defaultKey: 'Ctrl+E' },
    { id: 'text-preview',        label: 'معاينة النص الكامل',                    category: 'tools',          defaultKey: 'Ctrl+P' },
    { id: 'dashboard',           label: 'لوحة التقدم',                           category: 'tools',          defaultKey: 'Ctrl+Shift+D' },

    { id: 'delete-block',        label: 'حذف الكتلة المحددة',                    category: 'block',   defaultKey: 'Ctrl+Delete' },
    { id: 'toggle-reviewed',     label: 'تبديل حالة المراجعة للكتلة المحددة',    category: 'block',   defaultKey: 'Ctrl+Shift+M' },
    { id: 'block-font-increase', label: 'تكبير حجم عرض النص',                    category: 'block',   defaultKey: 'Ctrl+=' },
    { id: 'block-font-decrease', label: 'تصغير حجم عرض النص',                    category: 'block',   defaultKey: 'Ctrl+-' },
    { id: 'block-font-reset',    label: 'إعادة ضبط حجم عرض النص',                category: 'block',   defaultKey: 'Ctrl+0' },

    { id: 'crop-zoom-in',        label: 'تكبير الاقتطاع',                        category: 'crop',       defaultKey: 'Alt+=' },
    { id: 'crop-zoom-out',       label: 'تصغير الاقتطاع',                        category: 'crop',       defaultKey: 'Alt+-' },
    { id: 'crop-zoom-reset',     label: 'إعادة ضبط تكبير الاقتطاع',              category: 'crop',       defaultKey: 'Alt+0' },

    { id: 'fmt-bold',            label: 'غامق',                                 category: 'formatting',     defaultKey: 'Ctrl+B' },
    { id: 'fmt-italic',          label: 'مائل',                                 category: 'formatting',     defaultKey: 'Ctrl+I' },
    { id: 'fmt-underline',       label: 'تسطير',                                category: 'formatting',     defaultKey: 'Ctrl+U' },
    { id: 'fmt-strike',          label: 'يتوسطه خط',                            category: 'formatting',     defaultKey: 'Ctrl+Shift+X' },
    { id: 'fmt-superscript',     label: 'نص علوي',                              category: 'formatting',     defaultKey: 'Ctrl+.' },
    { id: 'fmt-subscript',       label: 'نص سفلي',                              category: 'formatting',     defaultKey: 'Ctrl+,' },
    { id: 'fmt-remove',          label: 'فرشاة إزالة التنسيق',                   category: 'formatting',     defaultKey: 'Ctrl+Shift+N' },
    { id: 'brush-tashkeel',      label: 'فرشاة إزالة التشكيل',                   category: 'formatting',     defaultKey: 'Ctrl+Shift+T' },
    { id: 'brush-format',        label: 'فرشاة نسخ التنسيق',                     category: 'formatting',     defaultKey: 'Ctrl+Shift+C' },

    { id: 'align-right',         label: 'محاذاة لليمين',                        category: 'alignment',   defaultKey: 'Ctrl+Shift+R' },
    { id: 'align-left',          label: 'محاذاة لليسار',                        category: 'alignment',   defaultKey: 'Ctrl+Shift+L' },
    { id: 'align-center',        label: 'محاذاة للوسط',                         category: 'alignment',   defaultKey: 'Ctrl+Shift+E' },
    { id: 'align-justify',       label: 'ضبط (محاذاة الطرفين)',                  category: 'alignment',   defaultKey: 'Ctrl+Shift+J' },
    { id: 'dir-rtl',             label: 'اتجاه النص: من اليمين لليسار',          category: 'alignment',   defaultKey: 'Ctrl+Shift+9' },
    { id: 'dir-ltr',             label: 'اتجاه النص: من اليسار لليمين',          category: 'alignment',   defaultKey: 'Ctrl+Shift+0' },

    { id: 'focus-next-block',    label: 'الانتقال للكتلة التالية (حفظ تلقائي)', category: 'block',   defaultKey: 'Tab' },
    { id: 'focus-prev-block',    label: 'الانتقال للكتلة السابقة (حفظ تلقائي)', category: 'block',   defaultKey: 'Shift+Tab' },
    
];

// Merge persisted settings (from disk, via the backend) into the
// in-memory defaults above. Safe to call multiple times.
async function loadPersistedAppSettings() {
    if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.get_app_settings) return;
    try {
        const persisted = await window.pywebview.api.get_app_settings();
        if (persisted && typeof persisted === 'object') {
            Object.assign(window.__appSettings, persisted);
        }
    } catch (e) {
        console.error('Failed to load persisted app settings:', e);
    } finally {
        window.dispatchEvent(new Event('appSettingsLoaded'));
    }
}

// Persist the current window.__appSettings to disk via the backend.
async function saveAppSettings() {
    if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.save_app_settings) return false;
    try {
        await window.pywebview.api.save_app_settings(window.__appSettings);
        return true;
    } catch (e) {
        console.error('Failed to save app settings:', e);
        return false;
    }
}

const ARABIC_TO_LATIN_KEYS = {
    'ض': 'Q', 'ص': 'W', 'ث': 'E', 'ق': 'R', 'ف': 'T', 'غ': 'Y', 'ع': 'U', 'ه': 'I', 'خ': 'O', 'ح': 'P', 'ج': '[', 'د': ']',
    'ش': 'A', 'س': 'S', 'ي': 'D', 'ب': 'F', 'ل': 'G', 'ت': 'J', 'ن': 'K', 'م': 'L', 'ك': ';', 'ط': "'",
    'ئ': 'Z', 'ء': 'X', 'ؤ': 'C', 'ر': 'V', 'لا': 'B', 'ى': 'N', 'ة': 'M', 'و': ',', 'ز': '.', 'ظ': '/',
    'آ': 'N', 'أ': 'H', 'إ': 'Y', 'ـ': 'J'
};
window.ARABIC_TO_LATIN_KEYS = ARABIC_TO_LATIN_KEYS;

// Turns a KeyboardEvent into a "Ctrl+Shift+X" style string. Shared by the
// review page's live shortcut dispatcher and the settings page's shortcut
// recorder, so recorded and matched combos always agree exactly.
// Layout-independent: works seamlessly for both Arabic and English keyboard layouts!
function normalizeKeyCombo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl'); // treat Cmd like Ctrl (mac-friendly)
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    const namedKeys = {
        ' ': 'Space', 'Escape': 'Escape', 'Delete': 'Delete', 'Backspace': 'Backspace',
        'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown', 'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
        'PageUp': 'PageUp', 'PageDown': 'PageDown', 'Home': 'Home', 'End': 'End',
        'Tab': 'Tab', 'Enter': 'Enter',
    };
    let key = e.key;

    if (namedKeys[key]) {
        key = namedKeys[key];
    } else if (/^F\d{1,2}$/.test(key)) {
        // F1-F12, leave as-is
    } else if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        return null; // modifier-only keydown, not a complete combo yet
    } else {
        // Layout-Independent physical key detection (supports Arabic & English layouts)
        if (e.code && /^Key[A-Z]$/i.test(e.code)) {
            key = e.code.slice(3).toUpperCase();
        } else if (e.code && /^Digit[0-9]$/.test(e.code)) {
            key = e.code.slice(5);
        } else if (ARABIC_TO_LATIN_KEYS[key]) {
            key = ARABIC_TO_LATIN_KEYS[key];
        } else {
            key = key.length === 1 ? key.toUpperCase() : key;
        }
    }
    parts.push(key);
    return parts.join('+');
}

// Returns the effective (possibly user-remapped) key combo string for a
// command id, falling back to its registered default.
function getShortcutFor(commandId) {
    const override = window.__appSettings?.keyboardShortcuts?.[commandId];
    if (override) return override;
    const cmd = window.__KEYBOARD_COMMANDS.find(c => c.id === commandId);
    return cmd ? cmd.defaultKey : '';
}

if (window.pywebview) {
    loadPersistedAppSettings();
} else {
    window.addEventListener('pywebviewready', loadPersistedAppSettings);
}