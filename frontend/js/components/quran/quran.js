let savedSelectionRange = null;
let savedEditableTarget = null;
let quranSurahs = [];

// Pagination Globals
let currentQuranResults = [];
let quranRenderIndex = 0;
const QURAN_BATCH_SIZE = 10;

async function initQuranFeature() {
    // 1. تحميل قائمة السور للقائمة المنسدلة (التاب اليدوي)
    quranSurahs = await window.pywebview.api.quran_get_surahs();
    const surahSelect = document.getElementById('quran-surah-select');
    if (surahSelect && quranSurahs) {
        surahSelect.innerHTML = quranSurahs.map(s => 
            `<option value="${s.id}">${s.id}. سورة ${s.name_arabic} (${s.verses_count} آية)</option>`
        ).join('');
    }

    setupContextMenu();
    setupQuranModal();
}

// ==========================================
// 1. CONTEXT MENU & TEXT SELECTION LOGIC
// ==========================================
function saveCursorSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        savedSelectionRange = sel.getRangeAt(0);
        savedEditableTarget = lastFocusedEditable; // من ملف review.js
    } else {
        savedSelectionRange = null;
    }
}

function restoreAndInsertText(textToInsert) {
    // 1. Recover the target element from our global tracker
    const target = window.lastFocusedEditable;
    
    if (target) {
        target.focus();
        
        // 2. Restore selection if it exists
        if (savedSelectionRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
        }
        
        // 3. Insert the text using the browser's native command
        document.execCommand('insertText', false, textToInsert);
        
        // 4. Trigger blur to ensure the auto-review and auto-save logic kicks in
        target.blur();
    }
}

function setupContextMenu() {
    const ctxMenu = document.getElementById('custom-context-menu');
    const searchBtn = document.getElementById('ctx-search-quran');

    document.addEventListener('contextmenu', (e) => {
        const editable = e.target.closest('.block-content, #text-preview-body');
        const selText = window.getSelection().toString().trim();

        if (editable && selText.length > 0) {
            e.preventDefault(); 
            saveCursorSelection(); 

            ctxMenu.style.left = e.pageX + 'px';
            ctxMenu.style.top = e.pageY + 'px';
            ctxMenu.classList.remove('hidden');
        } else {
            ctxMenu.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#custom-context-menu')) {
            ctxMenu.classList.add('hidden');
        }
    });

    searchBtn.addEventListener('click', () => {
        const selText = window.getSelection().toString().trim();
        ctxMenu.classList.add('hidden');
        openQuranModal(selText);
    });
    
    document.addEventListener('click', (e) => {
    if (e.target.closest('#insert-quran-btn')) {
        // Save the currently focused block IMMEDIATELY
        if (window.lastFocusedEditable) {
            saveCursorSelection(); 
        }
        openQuranModal("");
    }
    });
}

// ==========================================
// 2. MODAL & TABS LOGIC
// ==========================================
function openQuranModal(initialSearchQuery) {
    const modal = document.getElementById('quran-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('quran-results-tbody').innerHTML = 
        `<tr><td colspan="3" style="text-align: center; color: #888; padding: 20px;">لا توجد نتائج. ابحث لإظهار الآيات.</td></tr>`;
    document.getElementById('quran-insert-confirm').disabled = true;
    document.getElementById('quran-select-all').checked = false;

    if (initialSearchQuery) {
        document.getElementById('quran-search-input').value = initialSearchQuery;
        document.querySelector('.quran-tab-btn[data-tab="quran-tab-text"]').click();
        triggerQuranSearch();
    }
}

function setupQuranModal() {
    document.querySelectorAll('.quran-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quran-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.quran-tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.remove('hidden');
        });
    });

    document.getElementById('quran-close').addEventListener('click', () => document.getElementById('quran-modal').classList.add('hidden'));
    document.getElementById('quran-overlay').addEventListener('click', () => document.getElementById('quran-modal').classList.add('hidden'));

    document.getElementById('quran-search-btn').addEventListener('click', triggerQuranSearch);
    document.getElementById('quran-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerQuranSearch();
    });
    document.getElementById('quran-fetch-manual-btn').addEventListener('click', triggerQuranManualFetch);
    document.getElementById('quran-insert-confirm').addEventListener('click', insertSelectedAyahs);

    // MASTER SELECT ALL LOGIC
    document.getElementById('quran-select-all')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.quran-ayah-checkbox').forEach(cb => cb.checked = isChecked);
        
        const insertBtn = document.getElementById('quran-insert-confirm');
        const checkedCount = document.querySelectorAll('.quran-ayah-checkbox:checked').length;
        insertBtn.disabled = checkedCount === 0;
        insertBtn.textContent = checkedCount > 0 ? `إدراج (${checkedCount}) آية` : 'إدراج التحديد';
    });
}

// ==========================================
// 3. SEARCH & PAGINATION LOGIC
// ==========================================
async function triggerQuranSearch() {
    const query = document.getElementById('quran-search-input').value.trim();
    if (!query) return;
    
    const tbody = document.getElementById('quran-results-tbody');
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px;">⏳ جاري البحث...</td></tr>`;
    
    currentQuranResults = await window.pywebview.api.quran_search(query);
    renderQuranBatch(false);
}

async function triggerQuranManualFetch() {
    const surahId = document.getElementById('quran-surah-select').value;
    const fromAyah = document.getElementById('quran-ayah-from').value;
    const toAyah = document.getElementById('quran-ayah-to').value;
    
    const tbody = document.getElementById('quran-results-tbody');
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px;">⏳ جاري الجلب...</td></tr>`;
    
    currentQuranResults = await window.pywebview.api.quran_get_range(surahId, fromAyah, toAyah);
    renderQuranBatch(false);
}

function renderQuranBatch(isAppending = false) {
    const tbody = document.getElementById('quran-results-tbody');
    const insertBtn = document.getElementById('quran-insert-confirm');
    
    if (!isAppending) {
        tbody.innerHTML = '';
        quranRenderIndex = 0;
        document.getElementById('quran-select-all').checked = false;
        insertBtn.disabled = true;
        insertBtn.textContent = 'إدراج التحديد';
    }

    if (!currentQuranResults || currentQuranResults.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #e74c3c; padding: 20px;">لم يتم العثور على نتائج.</td></tr>`;
        return;
    }

    const batch = currentQuranResults.slice(quranRenderIndex, quranRenderIndex + QURAN_BATCH_SIZE);
    const oldLoadMore = document.getElementById('quran-load-more-row');
    if (oldLoadMore) oldLoadMore.remove();

    batch.forEach(ayah => {
        const tr = document.createElement('tr');
        tr.className = 'quran-result-row';
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="quran-ayah-checkbox" value="${ayah.id}" style="width: 16px; height: 16px; cursor: pointer;">
            </td>
            <td style="font-size: 13px; color: #666; font-weight: bold;">
                ${ayah.surah.name_arabic} (${ayah.ayah_number})
            </td>
            <td dir="rtl" style="font-size: 28px !important; line-height: 1.8 !important; font-family: 'Traditional Arabic', 'Simplified Arabic', Arial, serif !important; color: #111 !important; padding: 15px !important; font-weight: bold;">
                ${ayah.text}
            </td>        `;
        
        tr.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = tr.querySelector('.quran-ayah-checkbox');
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
            }
        });
        tbody.appendChild(tr);
    });

    quranRenderIndex += QURAN_BATCH_SIZE;

    if (quranRenderIndex < currentQuranResults.length) {
        const tr = document.createElement('tr');
        tr.id = 'quran-load-more-row';
        tr.innerHTML = `<td colspan="3" style="padding: 0;"><button class="quran-load-more-btn">تحميل المزيد (${currentQuranResults.length - quranRenderIndex}) ▾</button></td>`;
        tr.querySelector('button').addEventListener('click', () => renderQuranBatch(true));
        tbody.appendChild(tr);
    }

    document.querySelectorAll('.quran-ayah-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const checkedCount = document.querySelectorAll('.quran-ayah-checkbox:checked').length;
            insertBtn.disabled = checkedCount === 0;
            insertBtn.textContent = checkedCount > 0 ? `إدراج (${checkedCount}) آية` : 'إدراج التحديد';
        });
    });
}

// ==========================================
// 4. INSERTION LOGIC
// ==========================================
async function insertSelectedAyahs() {
    const checkedBoxes = Array.from(document.querySelectorAll('.quran-ayah-checkbox:checked'));
    const ayahIds = checkedBoxes.map(cb => parseInt(cb.value));
    const withCitation = document.getElementById('quran-add-citation').checked;

    if (ayahIds.length === 0) return;

    const formattedText = await window.pywebview.api.quran_format_insertion(ayahIds, withCitation);
    document.getElementById('quran-modal').classList.add('hidden');
    restoreAndInsertText(formattedText);
}

document.addEventListener('DOMContentLoaded', () => {
    // التحقق الصارم من وجود الـ api
    if (window.pywebview && window.pywebview.api) {
        initQuranFeature();
    } else {
        window.addEventListener('pywebviewready', initQuranFeature);
    }
});