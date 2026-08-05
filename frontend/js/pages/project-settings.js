// js/project-settings.js

let currentProject = null;
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

async function initSettings() {
    if (!projectId) { window.location.href = 'projects.html'; return; }

    // Load project data
    currentProject = await window.pywebview.api.load_project(projectId);
    if (!currentProject) { alert('تعذّر تحميل المشروع'); return; }

    const meta = currentProject.metadata || {};

    // استرجاع كود المزامنة المحفوظ
    if (meta.cloud_share_id) {
        document.getElementById('host-cloud-password').value = meta.cloud_password || '';
        document.getElementById('host-cloud-result').innerHTML = `كود المشاركة المحفوظ (Share ID): <br><br> <span style="background: #e2e8f0; padding: 6px 10px; border-radius: 4px; color: #0f172a; user-select: all; display: inline-block; margin-top: 8px;">${meta.cloud_share_id}</span>`;
    }

    const textOpts = meta.text_features || {};

    // 1. Book Metadata
    document.getElementById('page-title-display').textContent = `إعدادات: ${meta.title}`;
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
            lanBadge.textContent = lanBroadcast.checked ? '🟢 مفعل' : '🔴 متوقف';
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
            if (!pw) { alert('يرجى إدخال كلمة مرور الشبكة المحلية للمالك'); return; }
            
            currentProject.metadata.lan_password = pw;
            currentProject.metadata.lan_broadcasting = true;
            lanBroadcast.checked = true;
            updateBadges();

            await window.pywebview.api.update_project_metadata(currentProject.id, currentProject.metadata);
            await window.pywebview.api.toggle_broadcasting(currentProject.id, 'lan', true);
            alert('تم حفظ كلمة المرور وربط وضع الشبكة المحلية بنجاح 📡');
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
            if (feedbackEl) feedbackEl.innerHTML = '⚠️ ' + res.errors.join(' | ');
            return false;
        }
        if (feedbackEl) feedbackEl.innerHTML = '<span style="color:#15803d;">✓ كلمة مرور قوية جداً</span>';
        return true;
    };

    lanPwdInput.addEventListener('input', () => validatePwd(lanPwdInput.value, 'lan-pwd-feedback'));

    // 4. Notifications
    document.getElementById('ps-notif-join').checked = meta.notif_join ?? true;
    document.getElementById('ps-notif-page').checked = meta.notif_page ?? true;
    document.getElementById('ps-notif-edit').checked = meta.notif_edit ?? false;

    // 5. Category Formatting Rules
    initCategoryFormatting(meta.category_formatting || {});
}

// ─── CATEGORY FORMATTING MANAGER ───
const BASE_CATEGORIES = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Picture':'#2c3e50','Section-header':'#1abc9c','Table':'#d35400',
    'Text':'#2ecc71','Title':'#c0392b'
};

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

function getDynamicCategories() {
    const custom = window.__appSettings?.customCategories || {};
    return Object.keys({ ...BASE_CATEGORIES, ...custom });
}

function getCategoryLabelAR(catName) {
    return CATEGORY_ARABIC_MAP[catName] || catName;
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
                let optionsHtml = `<option value="">الافتراضي</option>`;
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
            alert('كلمة مرور الشبكة المحلية غير مستوفية لشروط الأمان: ' + vLan.errors.join(', '));
            return;
        }
    }

    saveCurrentCategoryFormattingUI(activeCategory);
    const btn = document.getElementById('btn-save');
    btn.disabled = true; btn.textContent = 'جاري الحفظ...';

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
                window.AestheticDialog.confirm({
                    title: 'تطبيق معالجة النصوص والتنسيقات 🎨',
                    message: `تم حفظ إعدادات المشروع بنجاح!<br><br>يحتوي المشروع على <strong>${ocredPagesCount} صفحة مُعالجة سابقاً</strong>.<br>هل ترغب في إعادة تطبيق القواعد والتنسيقات الجديدة (التشكيل، الأرقام، الكشيدة، خطوط وتنسيقات التصنيفات... إلخ) على كافة صفحات المشروع الآن؟`,
                    confirmText: 'نعم، طبق على الصفحات',
                    cancelText: 'لا، حفظ الإعدادات فقط',
                    onConfirm: async () => {
                        btn.textContent = 'جاري المعالجة... ⏳';
                        try {
                            const reapplyRes = await window.pywebview.api.reapply_text_processing_to_project(currentProject.id);
                            if (reapplyRes && reapplyRes.ok) {
                                window.AestheticDialog.alert({
                                    title: 'تم بنجاح ✨',
                                    message: `تمت إعادة تطبيق المعالجة النصية والتنسيقات على <strong>${reapplyRes.count} صفحة</strong> بنجاح!`,
                                    onOk: finishAndRedirect
                                });
                            } else {
                                window.AestheticDialog.alert({
                                    title: 'تنبيه',
                                    message: 'حدث خطأ أثناء إعادة التطبيق: ' + (reapplyRes?.error || 'غير معروف'),
                                    onOk: finishAndRedirect
                                });
                            }
                        } catch (reapplyErr) {
                            console.error('Reapply processing failed:', reapplyErr);
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
            window.AestheticDialog.alert({ title: 'خطأ', message: 'حدث خطأ أثناء حفظ الإعدادات.' });
        } else {
            alert('حدث خطأ أثناء الحفظ.');
        }
        btn.disabled = false; btn.textContent = 'حفظ الإعدادات';
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