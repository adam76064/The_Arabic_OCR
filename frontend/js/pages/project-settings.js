// js/project-settings.js

let currentProject = null;
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

async function initSettings() {
    if (!projectId) { window.location.href = 'projects.html'; return; }

    // Load project data
    currentProject = await window.pywebview.api.load_project(projectId);
    if (!currentProject) { alert(window.AppI18n.t('projectSettings.loadFailed')); return; }

    const meta = currentProject.metadata || {};

    // استرجاع كود المزامنة المحفوظ
    if (meta.cloud_share_id) {
        document.getElementById('host-cloud-password').value = meta.cloud_password || '';
        document.getElementById('host-cloud-result').innerHTML = `كود المشاركة المحفوظ (Share ID): <br><br> <span style="background: #e2e8f0; padding: 6px 10px; border-radius: 4px; color: #0f172a; user-select: all; display: inline-block; margin-top: 8px;">${meta.cloud_share_id}</span>`;
    }

    const textOpts = meta.text_features || {};

    // 1. Book Metadata
    document.getElementById('page-title-display').textContent = window.AppI18n.t('projectSettings.title', { title: meta.title });
    document.getElementById('ps-title').value = meta.title || '';
    document.getElementById('ps-author').value = meta.author || '';
    document.getElementById('ps-publisher').value = meta.publisher || '';
    document.getElementById('ps-logical-start').value = meta.logical_start || 1;

    // 2. Text Processing Rules
    document.getElementById('ps-remove-kasheeda').checked = textOpts.remove_kasheeda ?? true;
    document.getElementById('ps-clean-lines').checked = textOpts.clean_extra_lines ?? false;
    document.getElementById('ps-clean-spaces').checked = textOpts.clean_double_spaces ?? false;
    document.getElementById('ps-fix-punct').checked = textOpts.fix_punctuation ?? false;
    document.getElementById('ps-fix-waw').checked = textOpts.fix_waw ?? false;
    document.getElementById('ps-super-footnotes').checked = textOpts.superscript_footnotes ?? false;
    document.getElementById('ps-norm-hamza').checked = textOpts.normalize_hamza ?? false;

    const tashkeel = textOpts.tashkeel_option || 'none';
    document.querySelector(`input[name="ps_tashkeel"][value="${tashkeel}"]`).checked = true;
    
    const tanween = textOpts.tanween_option || 'none';
    document.querySelector(`input[name="ps_tanween"][value="${tanween}"]`).checked = true;

    const numbers = textOpts.numbers_option || 'none';
    const numbersRadio = document.querySelector(`input[name="ps_numbers"][value="${numbers}"]`);
    if (numbersRadio) numbersRadio.checked = true;

    // Live Sandbox updating
    const updateLiveSandbox = () => {
        const input = document.getElementById('sandbox-input')?.value || '';
        const outputEl = document.getElementById('sandbox-output');
        if (!outputEl) return;

        let res = input;
        if (document.getElementById('ps-remove-kasheeda')?.checked) res = res.replace(/\u0640+/g, '');
        if (document.getElementById('ps-clean-spaces')?.checked) res = res.replace(/[ \t]+/g, ' ');
        if (document.getElementById('ps-fix-punct')?.checked) res = res.replace(/\s+([،؛.؟!])/g, '$1 ');
        if (document.getElementById('ps-fix-waw')?.checked) res = res.replace(/(^|\s)و\s+/g, '$1و');

        const curTashkeel = document.querySelector('input[name="ps_tashkeel"]:checked')?.value || 'none';
        if (curTashkeel === 'remove_all') res = res.replace(/[\u064B-\u0652\u0670]/g, '');
        else if (curTashkeel === 'keep_tanween') res = res.replace(/[\u064E\u064F\u0650\u0652\u0670]/g, '');

        const curTanween = document.querySelector('input[name="ps_tanween"]:checked')?.value || 'none';
        if (curTanween === 'before_alf') res = res.replace(/اً/g, 'ًا');
        else if (curTanween === 'on_alf') res = res.replace(/ًا/g, 'اً');

        const curNums = document.querySelector('input[name="ps_numbers"]:checked')?.value || 'none';
        if (curNums === 'to_arabic') {
            const hindiDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
            hindiDigits.forEach((d, i) => { res = res.replaceAll(d, String(i)); });
        } else if (curNums === 'to_hindu') {
            const hindiDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
            for (let i = 0; i <= 9; i++) { res = res.replaceAll(String(i), hindiDigits[i]); }
        }

        outputEl.textContent = res;
    };

    document.querySelectorAll('#project-settings-form input, #sandbox-input').forEach(el => {
        el.addEventListener('input', updateLiveSandbox);
        el.addEventListener('change', updateLiveSandbox);
    });
    updateLiveSandbox();

    // 3. Networking & Cooperative Settings
    const lanBroadcast = document.getElementById('ps-lan-broadcast');
    const lanBadge = document.getElementById('lan-status-badge');
    const lanPwdInput = document.getElementById('ps-lan-password');
    const autoSaveSelect = document.getElementById('ps-autosave-interval');

    lanBroadcast.checked = meta.lan_broadcasting ?? false;
    lanPwdInput.value = meta.lan_password || '';
    autoSaveSelect.value = meta.autosave_interval ?? 5;

    const updateBadges = () => {
        if (lanBadge) {
            lanBadge.textContent = lanBroadcast.checked ? window.AppI18n.t('projectSettings.enabled') : window.AppI18n.t('projectSettings.stopped');
            lanBadge.style.background = lanBroadcast.checked ? '#dcfce7' : '#fee2e2';
            lanBadge.style.color = lanBroadcast.checked ? '#15803d' : '#b91c1c';
        }
    };
    updateBadges();

    lanBroadcast.addEventListener('change', async () => {
        updateBadges();
        await window.pywebview.api.toggle_broadcasting(currentProject.id, 'lan', lanBroadcast.checked);
    });

    // LAN Tabs Switching Logic
    const lanTabHostBtn = document.getElementById('lan-tab-host-btn');
    const lanTabMemberBtn = document.getElementById('lan-tab-member-btn');
    const lanTabHostSec = document.getElementById('lan-tab-host-sec');
    const lanTabMemberSec = document.getElementById('lan-tab-member-sec');
    const memberLanPwdInput = document.getElementById('member-lan-password');

    if (memberLanPwdInput) memberLanPwdInput.value = meta.lan_password || '';

    if (lanTabHostBtn && lanTabMemberBtn) {
        lanTabHostBtn.addEventListener('click', () => {
            lanTabHostSec.classList.remove('hidden');
            lanTabMemberSec.classList.add('hidden');
            lanTabHostBtn.style.color = '#0369a1';
            lanTabHostBtn.style.borderBottom = '2px solid #0369a1';
            lanTabMemberBtn.style.color = '#64748b';
            lanTabMemberBtn.style.borderBottom = 'none';
        });

        lanTabMemberBtn.addEventListener('click', () => {
            lanTabMemberSec.classList.remove('hidden');
            lanTabHostSec.classList.add('hidden');
            lanTabMemberBtn.style.color = '#0369a1';
            lanTabMemberBtn.style.borderBottom = '2px solid #0369a1';
            lanTabHostBtn.style.color = '#64748b';
            lanTabHostBtn.style.borderBottom = 'none';
        });
    }

    const btnLinkLan = document.getElementById('btn-link-lan');
    if (btnLinkLan) {
        btnLinkLan.addEventListener('click', async () => {
            const pw = memberLanPwdInput.value;
            if (!pw) { alert(window.AppI18n.t('projectSettings.ownerPasswordRequired')); return; }
            
            currentProject.metadata.lan_password = pw;
            currentProject.metadata.lan_broadcasting = true;
            lanBroadcast.checked = true;
            updateBadges();

            await window.pywebview.api.update_project_metadata(currentProject.id, currentProject.metadata);
            await window.pywebview.api.toggle_broadcasting(currentProject.id, 'lan', true);
            alert(window.AppI18n.t('projectSettings.lanSaved'));
        });
    }

    // Cloud Tabs Switching Logic
    const tabHostBtn = document.getElementById('cloud-tab-host-btn');
    const tabMemberBtn = document.getElementById('cloud-tab-member-btn');
    const tabHostSec = document.getElementById('cloud-tab-host-sec');
    const tabMemberSec = document.getElementById('cloud-tab-member-sec');

    // Password strength check helper
    const validatePwd = async (pwd, feedbackElId) => {
        const feedbackEl = document.getElementById(feedbackElId);
        if (!pwd) { if (feedbackEl) feedbackEl.textContent = ''; return true; }
        const res = await window.pywebview.api.validate_password_strength(pwd);
        if (!res.valid) {
            if (feedbackEl) feedbackEl.innerHTML = res.errors.join(' | ');
            return false;
        }
        if (feedbackEl) feedbackEl.innerHTML = `<span style="color:#15803d;">${window.AppI18n.t('projectSettings.strongPassword')}</span>`;
        return true;
    };

    lanPwdInput.addEventListener('input', () => validatePwd(lanPwdInput.value, 'lan-pwd-feedback'));

    // 4. Notifications
    document.getElementById('ps-notif-join').checked = meta.notif_join ?? true;
    document.getElementById('ps-notif-page').checked = meta.notif_page ?? true;
    document.getElementById('ps-notif-edit').checked = meta.notif_edit ?? false;

    // 5. Category Formatting Rules
    initCategoryFormatting(meta.category_formatting || {});

    // 6. Post-Processing Settings
    initPostProcessingSettings(meta.post_processing || {});
}

// ─── CATEGORY FORMATTING MANAGER ───
const BASE_CATEGORIES = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Page-number':'#0984e3','Picture':'#2c3e50','Section-header':'#1abc9c',
    'Table':'#d35400','Text':'#2ecc71','Title':'#c0392b',
    'Vertical-poetry':'#e84393', 'Staggered-poetry':'#00cec9'
};

function getDynamicCategories() {
    const custom = window.__appSettings?.customCategories || {};
    return Object.keys({ ...BASE_CATEGORIES, ...custom });
}

function getCategoryLabelAR(catName) {
    return window.AppI18n?.categoryLabel(catName) || catName;
}

let categoryFormatting = {};
let activeCategory = 'Text';

async function initCategoryFormatting(savedFormatting) {
    categoryFormatting = JSON.parse(JSON.stringify(savedFormatting || {}));

    const catSelect = document.getElementById('cat-fmt-select');
    if (!catSelect) return;

    // Dynamically populate categories (standard + user custom categories)
    const allCats = getDynamicCategories();
    catSelect.innerHTML = allCats.map(cat => {
        const ar = getCategoryLabelAR(cat);
        const label = ar === cat ? cat : `${ar} (${cat})`;
        return `<option value="${cat}">${label}</option>`;
    }).join('');

    // Dynamically load installed system fonts into font family dropdown
    await populateSystemFontsForCategoryFormatting();

    activeCategory = catSelect.value || 'Text';
    loadCategoryFormattingUI(activeCategory);

    catSelect.addEventListener('change', (e) => {
        saveCurrentCategoryFormattingUI(activeCategory);
        activeCategory = e.target.value;
        loadCategoryFormattingUI(activeCategory);
    });

    // Color pickers sync
    const colorPicker = document.getElementById('cf-color-picker');
    const colorText = document.getElementById('cf-color');
    colorPicker?.addEventListener('input', (e) => { colorText.value = e.target.value; });
    colorText?.addEventListener('change', (e) => { if (e.target.value) colorPicker.value = e.target.value; });

    const bgPicker = document.getElementById('cf-bg-picker');
    const bgText = document.getElementById('cf-bg-color');
    bgPicker?.addEventListener('input', (e) => { bgText.value = e.target.value; });
    bgText?.addEventListener('change', (e) => { if (e.target.value) bgPicker.value = e.target.value; });
}

async function populateSystemFontsForCategoryFormatting() {
    const fontDropdown = document.getElementById('cf-font-family');
    if (!fontDropdown) return;
    try {
        if (window.pywebview?.api?.get_system_fonts) {
            const res = await window.pywebview.api.get_system_fonts();
            if (res && res.ok && res.fonts && res.fonts.length > 0) {
                let optionsHtml = `<option value="">${window.AppI18n.t('ps.default')}</option>`;
                res.fonts.forEach(font => {
                    const fontValue = font.includes(' ') ? "'" + font + "'" : font;
                    const displayName = font.length > 28 ? font.substring(0, 28) + '...' : font;
                    optionsHtml += `<option value="${fontValue}" title="${font}">${displayName}</option>`;
                });
                fontDropdown.innerHTML = optionsHtml;
            }
        }
    } catch (err) {
        console.error("Could not load system fonts for category formatting:", err);
    }
}

function loadCategoryFormattingUI(category) {
    const fmt = categoryFormatting[category] || {};
    document.getElementById('cf-bold').checked = !!fmt.bold;
    document.getElementById('cf-italic').checked = !!fmt.italic;
    document.getElementById('cf-underline').checked = !!fmt.underline;
    document.getElementById('cf-font-family').value = fmt.fontFamily || '';
    document.getElementById('cf-font-size').value = fmt.fontSize || '';
    document.getElementById('cf-direction').value = fmt.dir || 'rtl';
    document.getElementById('cf-align').value = fmt.align || (category === 'Title' || category === 'Section-header' ? 'center' : 'right');
    document.getElementById('cf-line-spacing').value = fmt.lineSpacing || '';
    document.getElementById('cf-space-before').value = fmt.spaceBefore || '';
    document.getElementById('cf-space-after').value = fmt.spaceAfter || '';
    document.getElementById('cf-color').value = fmt.color || '#000000';
    document.getElementById('cf-color-picker').value = fmt.color || '#000000';
    document.getElementById('cf-bg-color').value = fmt.bgColor || '';
    document.getElementById('cf-bg-picker').value = fmt.bgColor || '#ffffff';
}

function saveCurrentCategoryFormattingUI(category) {
    if (!category) return;
    categoryFormatting[category] = {
        bold: document.getElementById('cf-bold').checked,
        italic: document.getElementById('cf-italic').checked,
        underline: document.getElementById('cf-underline').checked,
        fontFamily: document.getElementById('cf-font-family').value,
        fontSize: document.getElementById('cf-font-size').value,
        dir: document.getElementById('cf-direction').value,
        align: document.getElementById('cf-align').value,
        lineSpacing: document.getElementById('cf-line-spacing').value,
        spaceBefore: document.getElementById('cf-space-before').value,
        spaceAfter: document.getElementById('cf-space-after').value,
        color: document.getElementById('cf-color').value.trim(),
        bgColor: document.getElementById('cf-bg-color').value.trim()
    };
}

document.getElementById('project-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const lanPwd = document.getElementById('ps-lan-password').value;

    if (lanPwd) {
        const vLan = await window.pywebview.api.validate_password_strength(lanPwd);
        if (!vLan.valid) {
            alert(window.AppI18n.t('projectSettings.passwordWeak', { errors: vLan.errors.join(', ') }));
            return;
        }
    }

    saveCurrentCategoryFormattingUI(activeCategory);
    const btn = document.getElementById('btn-save');
    btn.disabled = true; btn.textContent = window.AppI18n.t('projectSettings.saving');

    const tashkeelVal = document.querySelector('input[name="ps_tashkeel"]:checked').value;

    const newMetadata = {
        title: document.getElementById('ps-title').value.trim(),
        author: document.getElementById('ps-author').value.trim(),
        publisher: document.getElementById('ps-publisher').value.trim(),
        logical_start: parseInt(document.getElementById('ps-logical-start').value) || 1,
        lan_broadcasting: document.getElementById('ps-lan-broadcast').checked,
        lan_password: lanPwd || null,
        autosave_interval: parseInt(document.getElementById('ps-autosave-interval').value) || 5,
        notif_join: document.getElementById('ps-notif-join').checked,
        notif_page: document.getElementById('ps-notif-page').checked,
        notif_edit: document.getElementById('ps-notif-edit').checked,
        category_formatting: categoryFormatting,
        text_features: {
            remove_kasheeda: document.getElementById('ps-remove-kasheeda').checked,
            clean_extra_lines: document.getElementById('ps-clean-lines').checked,
            clean_double_spaces: document.getElementById('ps-clean-spaces').checked,
            fix_punctuation: document.getElementById('ps-fix-punct').checked,
            fix_waw: document.getElementById('ps-fix-waw').checked,
            superscript_footnotes: document.getElementById('ps-super-footnotes').checked,
            normalize_hamza: document.getElementById('ps-norm-hamza').checked,
            tashkeel_option: tashkeelVal,
            tanween_option: document.querySelector('input[name="ps_tanween"]:checked').value,
            numbers_option: document.querySelector('input[name="ps_numbers"]:checked')?.value || 'none',
            remove_all_tashkeel: tashkeelVal === 'remove_all',
            remove_tashkeel_keep_tanween: tashkeelVal === 'keep_tanween'
        },
        post_processing: {
            auto_sort_reading_order: document.getElementById('ps-sort-reading-order')?.checked ?? false,
            detect_pagination: document.getElementById('ps-detect-pagination')?.checked ?? false,
        }
    };

    try {
        currentProject.metadata = { ...currentProject.metadata, ...newMetadata };
        
        // إرسال الإعدادات الجديدة مباشرة إلى بايثون لحفظها في القرص الصلب
        const response = await window.pywebview.api.update_project_metadata(currentProject.id, newMetadata);
        
        if (response && response.ok !== false) {
            const ocredPagesCount = (currentProject.pages || []).filter(p => p.ocr_data && p.ocr_data.length > 0).length;
            
            const finishAndRedirect = () => {
                window.location.href = `project-dashboard.html?id=${currentProject.id}`;
            };

            if (ocredPagesCount > 0 && window.AestheticDialog?.confirm) {
                window.__selectedApplyScope = 'unreviewed';
                const messageHtml = `
                    <p style="margin-bottom: 12px; font-size: 14px; color: #334155;">
                        ${window.AppI18n.t('projectSettings.savedSummary')}<br>
                        ${window.AppI18n.t('projectSettings.processedPages', { count: ocredPagesCount })}<br>
                        ${window.AppI18n.t('projectSettings.applyQuestion')}
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="apply_scope" value="all" onchange="window.__selectedApplyScope=this.value" style="width: 16px; height: 16px;">
                            <span style="font-size: 14px; font-weight: 500; color: #0f172a;">${window.AppI18n.t('projectSettings.applyAll')}</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="apply_scope" value="unreviewed" checked onchange="window.__selectedApplyScope=this.value" style="width: 16px; height: 16px;">
                            <span style="font-size: 14px; font-weight: 500; color: #0f172a;">${window.AppI18n.t('projectSettings.applyUnreviewed')}</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="apply_scope" value="none" onchange="window.__selectedApplyScope=this.value" style="width: 16px; height: 16px;">
                            <span style="font-size: 14px; font-weight: 500; color: #0f172a;">${window.AppI18n.t('projectSettings.applyLater')}</span>
                        </label>
                    </div>
                `;

                window.AestheticDialog.confirm({
                    title: window.AppI18n.t('projectSettings.applyTitle'),
                    message: messageHtml,
                    confirmText: window.AppI18n.t('projectSettings.apply'),
                    cancelText: window.AppI18n.t('dialog.cancel'),
                    onConfirm: async () => {
                        const selectedScope = window.__selectedApplyScope || 'unreviewed';
                        if (selectedScope === 'none') {
                            finishAndRedirect();
                            return;
                        }
                        
                        btn.textContent = window.AppI18n.t('projectSettings.applying');
                        try {
                            const res = await window.pywebview.api.apply_project_settings_changes(currentProject.id, selectedScope);
                            if (res && res.ok) {
                                window.AestheticDialog.alert({
                                    title: window.AppI18n.t('projectSettings.successTitle'),
                                    message: window.AppI18n.t('projectSettings.applySuccess'),
                                    onOk: finishAndRedirect
                                });
                            } else {
                                window.AestheticDialog.alert({
                                    title: window.AppI18n.t('dialog.alert'),
                                    message: window.AppI18n.t('projectSettings.applyError', { error: res?.error || window.AppI18n.t('projectSettings.unknownError') }),
                                    onOk: finishAndRedirect
                                });
                            }
                        } catch (err) {
                            console.error('Settings apply failed:', err);
                            finishAndRedirect();
                        }
                    },
                    onCancel: finishAndRedirect
                });
            } else {
                finishAndRedirect();
            }
        } else {
            throw new Error(response?.error || 'Unknown error saving to disk');
        }
    } catch (err) {
        console.error(err);
        if (window.AestheticDialog?.alert) {
            window.AestheticDialog.alert({ title: window.AppI18n.t('projectSettings.errorTitle'), message: window.AppI18n.t('projectSettings.saveError') });
        } else {
            alert(window.AppI18n.t('projectSettings.saveError'));
        }
        btn.disabled = false; btn.textContent = window.AppI18n.t('projectSettings.save');
    }
});

// توجيه زر الإلغاء وزر العودة إلى لوحة التحكم
const navigateToDashboard = () => { window.location.href = `project-dashboard.html?id=${projectId}`; };
document.getElementById('btn-cancel')?.addEventListener('click', navigateToDashboard);
document.getElementById('btn-back')?.addEventListener('click', navigateToDashboard);

// إزالة زر العودة للمراجعة القديم إن وجد
const backToReviewBtn = document.getElementById('back-to-review');
if (backToReviewBtn) backToReviewBtn.remove();


document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) initSettings();
    else window.addEventListener('pywebviewready', initSettings);
});

// ─── POST-PROCESSING SETTINGS ───────────────────────────────────────────────

function initPostProcessingSettings(ppOpts) {
    const sortToggle = document.getElementById('ps-sort-reading-order');
    const runBtn = document.getElementById('btn-run-reading-order-sort');
    const pagToggle = document.getElementById('ps-detect-pagination');
    const pagBtn = document.getElementById('btn-run-pagination-detect');

    if (sortToggle) sortToggle.checked = ppOpts.auto_sort_reading_order ?? false;
    if (pagToggle) pagToggle.checked = ppOpts.detect_pagination ?? false;

    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            if (!currentProject) return;
            runBtn.disabled = true;
            runBtn.textContent = window.AppI18n.t('projectSettings.sorting');
            try {
                const res = await window.pywebview.api.apply_reading_order_sorting(
                    currentProject.id, null, true
                );
                if (res?.ok) {
                    if (window.AestheticDialog?.alert) {
                        window.AestheticDialog.alert({
                            title: window.AppI18n.t('projectSettings.successTitle'),
                            message: window.AppI18n.t('projectSettings.sortSuccess', { count: res.count })
                        });
                    } else {
                        alert(window.AppI18n.t('projectSettings.sortSuccessShort', { count: res.count }));
                    }
                } else {
                    alert(window.AppI18n.t('projectSettings.actionError', { error: res?.error || window.AppI18n.t('projectSettings.unknownError') }));
                }
            } catch (err) {
                console.error('Reading order sorting error:', err);
                alert(window.AppI18n.t('projectSettings.sortError'));
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = window.AppI18n.t('ps.runReadingOrder');
            }
        });
    }

    if (pagBtn) {
        pagBtn.addEventListener('click', async () => {
            if (!currentProject) return;
            pagBtn.disabled = true;
            pagBtn.textContent = window.AppI18n.t('projectSettings.detecting');
            try {
                const res = await window.pywebview.api.apply_pagination_detection(
                    currentProject.id, null, true
                );
                if (res?.ok) {
                    if (window.AestheticDialog?.alert) {
                        window.AestheticDialog.alert({
                            title: window.AppI18n.t('projectSettings.successTitle'),
                            message: window.AppI18n.t('projectSettings.paginationSuccess', { count: res.count })
                        });
                    } else {
                        alert(window.AppI18n.t('projectSettings.paginationSuccess', { count: res.count }));
                    }
                } else {
                    alert(window.AppI18n.t('projectSettings.actionError', { error: res?.error || window.AppI18n.t('projectSettings.unknownError') }));
                }
            } catch (err) {
                console.error('Pagination detection error:', err);
                alert(window.AppI18n.t('projectSettings.paginationError'));
            } finally {
                pagBtn.disabled = false;
                pagBtn.textContent = window.AppI18n.t('ps.runPagination');
            }
        });
    }
}