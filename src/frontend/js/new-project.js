let selectedPdfPath = null;

function initApp() {
    const lanToggle = document.getElementById('lan-enabled-toggle');
    const lanPwRow = document.getElementById('lan-password-row');
    lanToggle.addEventListener('change', () => {
        lanPwRow.classList.toggle('hidden', !lanToggle.checked);
    });

    document.getElementById('pdf-file-input').addEventListener('click', async (e) => {
        e.preventDefault();
        const path = await window.pywebview.api.select_pdf();
        if (path) {
            selectedPdfPath = path;
            document.getElementById('selected-path-display').textContent = path;
        }
    });

    document.getElementById('new-project-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedPdfPath) { alert('الرجاء اختيار ملف PDF'); return; }

        const fd = new FormData(e.target);
        const tashkeelOption = fd.get('tashkeel_option');
        const metadata = {
            title: fd.get('title'),
            author: fd.get('author'),
            publisher: fd.get('publisher'),
            logical_start: parseInt(fd.get('logical_start')) || 1,
            lan_enabled: fd.get('lan_enabled') === 'on',
            lan_password: fd.get('lan_password') || null,
            text_features: {
                clean_extra_lines: fd.get('clean_extra_lines') === 'on',
                clean_double_spaces: fd.get('clean_double_spaces') === 'on',
                fix_punctuation: fd.get('fix_punctuation') === 'on',
                fix_waw: fd.get('fix_waw') === 'on',
                superscript_footnotes: fd.get('superscript_footnotes') === 'on',
                normalize_hamza: fd.get('normalize_hamza') === 'on',
                // tashkeel_option/tanween_option kept for display/debugging;
                // text_cleaner.py reads the two booleans below instead.
                tashkeel_option: tashkeelOption,
                tanween_option: fd.get('tanween_option'),
                remove_all_tashkeel: tashkeelOption === 'remove_all',
                remove_tashkeel_keep_tanween: tashkeelOption === 'keep_tanween',
            }
        };

        const project = await window.pywebview.api.create_project(metadata, selectedPdfPath);
        window.location.href = `review.html?id=${project.id}`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
    }
});
