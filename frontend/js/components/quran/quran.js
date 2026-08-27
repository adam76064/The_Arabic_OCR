/**
 * components/quran/quran.js - Quran search, browser & verse insertion module
 */
(function(global) {
  const quranText = (key, replacements) => global.AppI18n?.t(key, replacements) || key;

  let quranSavedSelectionRange = null;
  let quranSavedEditableTarget = null;
  let quranSurahs = [];

  // Pagination Globals
  let currentQuranResults = [];
  let quranRenderIndex = 0;
  const QURAN_BATCH_SIZE = 10;

  async function initQuranFeature() {
    // 1. تحميل قائمة السور للقائمة المنسدلة (التاب اليدوي)
    if (global.pywebview?.api?.quran_get_surahs) {
      try {
        quranSurahs = await global.pywebview.api.quran_get_surahs();
        const surahSelect = document.getElementById('quran-surah-select');
        if (surahSelect && quranSurahs) {
          surahSelect.innerHTML = quranSurahs.map(s => 
            `<option value="${s.id}">${s.id}. سورة ${s.name_arabic} (${s.verses_count} آية)</option>`
          ).join('');
        }
      } catch (err) {
        console.warn('Could not load quran surahs:', err);
      }
    }

    setupContextMenu();
    setupQuranModal();
  }

  // ==========================================
  // 1. CONTEXT MENU & TEXT SELECTION LOGIC
  // ==========================================
  function saveCursorSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      quranSavedSelectionRange = sel.getRangeAt(0).cloneRange();
      quranSavedEditableTarget = global.lastFocusedEditable;
    } else {
      quranSavedSelectionRange = null;
    }
  }

  function restoreAndInsertText(textToInsert) {
    const target = global.lastFocusedEditable || quranSavedEditableTarget;
    
    if (target) {
      target.focus();
      
      if (quranSavedSelectionRange) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(quranSavedSelectionRange);
        }
      }
      
      document.execCommand('insertText', false, textToInsert);
      if (global.persistBrushEdit) global.persistBrushEdit(target);
      target.blur();
    }
  }

  function setupContextMenu() {
    const ctxMenu = document.getElementById('custom-context-menu');
    const searchBtn = document.getElementById('ctx-search-quran');
    if (!ctxMenu || !searchBtn) return;

    document.addEventListener('contextmenu', (e) => {
      const editable = e.target.closest('.block-content, #text-preview-body');
      const selText = window.getSelection() ? window.getSelection().toString().trim() : '';

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
      const selText = window.getSelection() ? window.getSelection().toString().trim() : '';
      ctxMenu.classList.add('hidden');
      openQuranModal(selText);
    });
    
    document.addEventListener('click', (e) => {
      if (e.target.closest('#insert-quran-btn')) {
        if (global.lastFocusedEditable) {
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
    if (!modal) return;
    modal.classList.remove('hidden');
    
    const resultsTbody = document.getElementById('quran-results-tbody');
    if (resultsTbody) {
      resultsTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--color-text-muted); padding: 20px;">${quranText('quran.emptyPrompt')}</td></tr>`;
    }
    const insertBtn = document.getElementById('quran-insert-confirm');
    if (insertBtn) insertBtn.disabled = true;
    const selectAll = document.getElementById('quran-select-all');
    if (selectAll) selectAll.checked = false;

    if (initialSearchQuery) {
      const searchInput = document.getElementById('quran-search-input');
      if (searchInput) searchInput.value = initialSearchQuery;
      document.querySelector('.quran-tab-btn[data-tab="quran-tab-text"]')?.click();
      triggerQuranSearch();
    }
  }

  function setupQuranModal() {
    document.querySelectorAll('.quran-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quran-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.quran-tab-content').forEach(c => c.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab)?.classList.remove('hidden');
      });
    });

    document.getElementById('quran-close')?.addEventListener('click', () => document.getElementById('quran-modal')?.classList.add('hidden'));
    document.getElementById('quran-overlay')?.addEventListener('click', () => document.getElementById('quran-modal')?.classList.add('hidden'));

    document.getElementById('quran-search-btn')?.addEventListener('click', triggerQuranSearch);
    document.getElementById('quran-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerQuranSearch();
    });
    document.getElementById('quran-fetch-manual-btn')?.addEventListener('click', triggerQuranManualFetch);
    document.getElementById('quran-insert-confirm')?.addEventListener('click', insertSelectedAyahs);

    // MASTER SELECT ALL LOGIC
    document.getElementById('quran-select-all')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.quran-ayah-checkbox').forEach(cb => cb.checked = isChecked);
      
      const insertBtn = document.getElementById('quran-insert-confirm');
      const checkedCount = document.querySelectorAll('.quran-ayah-checkbox:checked').length;
      if (insertBtn) {
        insertBtn.disabled = checkedCount === 0;
        insertBtn.textContent = checkedCount > 0 ? quranText('quran.insertCount', { count: checkedCount }) : quranText('quran.insertSelection');
      }
    });
  }

  // ==========================================
  // 3. SEARCH & PAGINATION LOGIC
  // ==========================================
  async function triggerQuranSearch() {
    const query = document.getElementById('quran-search-input')?.value.trim();
    if (!query) return;
    
    const tbody = document.getElementById('quran-results-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px;">${quranText('quran.searching')}</td></tr>`;
    
    if (global.pywebview?.api?.quran_search) {
      currentQuranResults = await global.pywebview.api.quran_search(query);
    } else {
      currentQuranResults = [];
    }
    renderQuranBatch(false);
  }

  async function triggerQuranManualFetch() {
    const surahId = document.getElementById('quran-surah-select')?.value;
    const fromAyah = document.getElementById('quran-ayah-from')?.value;
    const toAyah = document.getElementById('quran-ayah-to')?.value;
    
    const tbody = document.getElementById('quran-results-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px;">${quranText('quran.fetching')}</td></tr>`;
    
    if (global.pywebview?.api?.quran_get_range) {
      currentQuranResults = await global.pywebview.api.quran_get_range(surahId, fromAyah, toAyah);
    } else {
      currentQuranResults = [];
    }
    renderQuranBatch(false);
  }

  function renderQuranBatch(isAppending = false) {
    const tbody = document.getElementById('quran-results-tbody');
    const insertBtn = document.getElementById('quran-insert-confirm');
    if (!tbody) return;
    
    if (!isAppending) {
      tbody.innerHTML = '';
      quranRenderIndex = 0;
      const selectAll = document.getElementById('quran-select-all');
      if (selectAll) selectAll.checked = false;
      if (insertBtn) {
        insertBtn.disabled = true;
        insertBtn.textContent = quranText('quran.insertSelection');
      }
    }

    if (!currentQuranResults || currentQuranResults.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--color-danger); padding: 20px;">${quranText('quran.noResults')}</td></tr>`;
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
              <input type="checkbox" class="quran-ayah-checkbox" value="${ayah.id}" style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary);">
          </td>
          <td style="font-size: 13px; color: var(--color-text-muted); font-weight: bold;">
              ${ayah.surah.name_arabic} (${ayah.ayah_number})
          </td>
          <td dir="rtl" style="font-size: 24px !important; line-height: 1.8 !important; font-family: 'Amiri', 'Traditional Arabic', 'Simplified Arabic', Arial, serif !important; color: var(--color-text) !important; padding: 15px !important; font-weight: bold;">
              ${ayah.text}
          </td>
      `;
      
      tr.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = tr.querySelector('.quran-ayah-checkbox');
          if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
          }
        }
      });
      tbody.appendChild(tr);
    });

    quranRenderIndex += QURAN_BATCH_SIZE;

    if (quranRenderIndex < currentQuranResults.length) {
      const tr = document.createElement('tr');
      tr.id = 'quran-load-more-row';
      tr.innerHTML = `<td colspan="3" style="padding: 0;"><button class="quran-load-more-btn" style="width:100%; padding: 10px; background: var(--color-surface-hover); border: none; cursor: pointer; color: var(--color-primary); font-weight: bold;">${quranText('quran.loadMore', { count: currentQuranResults.length - quranRenderIndex })}</button></td>`;
      tr.querySelector('button')?.addEventListener('click', () => renderQuranBatch(true));
      tbody.appendChild(tr);
    }

    document.querySelectorAll('.quran-ayah-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const checkedCount = document.querySelectorAll('.quran-ayah-checkbox:checked').length;
        if (insertBtn) {
          insertBtn.disabled = checkedCount === 0;
          insertBtn.textContent = checkedCount > 0 ? quranText('quran.insertCount', { count: checkedCount }) : quranText('quran.insertSelection');
        }
      });
    });
  }

  // ==========================================
  // 4. INSERTION LOGIC
  // ==========================================
  async function insertSelectedAyahs() {
    const checkedBoxes = Array.from(document.querySelectorAll('.quran-ayah-checkbox:checked'));
    const ayahIds = checkedBoxes.map(cb => parseInt(cb.value));
    const withCitation = document.getElementById('quran-add-citation')?.checked ?? true;

    if (ayahIds.length === 0) return;

    if (global.pywebview?.api?.quran_format_insertion) {
      const formattedText = await global.pywebview.api.quran_format_insertion(ayahIds, withCitation);
      document.getElementById('quran-modal')?.classList.add('hidden');
      restoreAndInsertText(formattedText);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (global.pywebview && global.pywebview.api) {
      initQuranFeature();
    } else {
      window.addEventListener('pywebviewready', initQuranFeature);
    }
  });

  global.openQuranModal = openQuranModal;
})(window);
