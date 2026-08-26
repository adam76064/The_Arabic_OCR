/**
 * components/command-palette.js — Spotlight Quick Action Palette (Ctrl+K / Ctrl+P).
 *
 * Provides instant keyboard-driven search to:
 * - Jump between views (Projects, Preprocessing, Dashboard, Review, Export, Settings)
 * - Toggle themes (Light / Dark mode)
 * - Trigger OCR / Preprocessing / Export workflows
 */
(function (global) {
  let isPaletteOpen = false;
  let paletteOverlay = null;

  function getIcon(name) {
    return global.AppIcons ? global.AppIcons.get(name) : '';
  }

  function getCommands() {
    const t = (k, def) => (global.AppI18n ? global.AppI18n.t(k) : def);
    const params = new URLSearchParams(window.location.search);
    const projId = params.get('id');
    const projQuery = projId ? `?id=${encodeURIComponent(projId)}` : '';

    const isDark = global.ThemeManager ? global.ThemeManager.isDark() : (document.documentElement.classList.contains('night-mode') || document.body?.classList.contains('night-mode'));

    const cmds = [
      {
        id: 'nav-home',
        title: t('nav.home', 'الرئيسية'),
        icon: 'home',
        category: 'navigation',
        action: () => (window.location.href = 'index.html')
      },
      {
        id: 'nav-projects',
        title: t('nav.projects', 'المشاريع'),
        icon: 'projects',
        category: 'navigation',
        action: () => (window.location.href = 'projects.html')
      },
      {
        id: 'new-project',
        title: t('nav.newProject', 'مشروع جديد'),
        icon: 'plus',
        shortcut: 'Ctrl+N',
        category: 'action',
        action: () => {
          if (global.ProjectCreatorModal) global.ProjectCreatorModal.open();
          else document.querySelector('.trigger-new-project')?.click();
        }
      },
      {
        id: 'toggle-theme',
        title: isDark ? (t('theme.toggleLight', 'تفعيل الوضع النهاري (Light Mode)')) : (t('theme.toggleDark', 'تفعيل الوضع الليلي (Dark Mode)')),
        icon: isDark ? 'sun' : 'moon',
        shortcut: 'Ctrl+Shift+D',
        category: 'view',
        action: () => {
          if (global.ThemeManager) {
            const next = global.ThemeManager.toggle();
            const nowDark = next === 'dark';
            if (global.AppNotify) global.AppNotify.show(nowDark ? (t('theme.darkMode', 'تم تفعيل الوضع الليلي')) : (t('theme.lightMode', 'تم تفعيل الوضع النهاري')), 'info');
          } else {
            const nowDark = document.documentElement.classList.toggle('night-mode');
            if (document.body) document.body.classList.toggle('night-mode', nowDark);
            try {
              localStorage.setItem('app_theme', nowDark ? 'dark' : 'light');
              if (global.AppNotify) global.AppNotify.show(nowDark ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري', 'info');
            } catch (e) {}
          }
        }
      },
      {
        id: 'nav-settings',
        title: t('nav.settings', 'الإعدادات العامة'),
        icon: 'settings',
        shortcut: 'Ctrl+,',
        category: 'navigation',
        action: () => (window.location.href = 'settings.html')
      }
    ];

    if (projId) {
      cmds.push(
        {
          id: 'proj-dashboard',
          title: t('dash.title', 'لوحة تحكم المشروع (OCR Dashboard)'),
          icon: 'dashboard',
          category: 'project',
          action: () => (window.location.href = `project-dashboard.html${projQuery}`)
        },
        {
          id: 'proj-preprocess',
          title: t('dash.stepPreprocess', 'المعالجة الأولية (ScanTailor Studio)'),
          icon: 'preprocess',
          category: 'project',
          action: () => (window.location.href = `preprocessing.html${projQuery}`)
        },
        {
          id: 'proj-review',
          title: t('dash.stepReview', 'محرر التدقيق والمراجعة (Review Studio)'),
          icon: 'review',
          category: 'project',
          action: () => (window.location.href = `review.html${projQuery}`)
        },
        {
          id: 'proj-export',
          title: t('export.title', 'تصدير المشروع (Export Studio)'),
          icon: 'export',
          category: 'project',
          action: () => (window.location.href = `export.html${projQuery}`)
        },
        {
          id: 'proj-settings',
          title: t('projectSettings.title', 'إعدادات المشروع الحالي'),
          icon: 'settings',
          category: 'project',
          action: () => (window.location.href = `project-settings.html${projQuery}`)
        }
      );
    }

    return cmds;
  }

  function openCommandPalette() {
    if (isPaletteOpen) return;
    isPaletteOpen = true;

    const t = (k, def) => (global.AppI18n ? global.AppI18n.t(k) : def);

    paletteOverlay = document.createElement('div');
    paletteOverlay.className = 'command-palette-overlay';
    paletteOverlay.innerHTML = `
      <div class="command-palette-box">
        <div class="command-palette-search">
          ${getIcon('search')}
          <input type="text" id="cmd-palette-input" placeholder="${t('command.placeholder', 'اكتب أمراً أو ابحث في الصفحات...')}" autocomplete="off">
        </div>
        <div class="command-palette-list" id="cmd-palette-list"></div>
      </div>
    `;

    document.body.appendChild(paletteOverlay);

    const input = paletteOverlay.querySelector('#cmd-palette-input');
    const list = paletteOverlay.querySelector('#cmd-palette-list');

    let selectedIndex = 0;
    let filteredCommands = getCommands();

    function renderList() {
      list.innerHTML = '';
      if (filteredCommands.length === 0) {
        list.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--color-text-muted); font-size: 13px;">${t('command.noResults', 'لا توجد أوامر مطابقة')}</div>`;
        return;
      }

      filteredCommands.forEach((cmd, idx) => {
        const item = document.createElement('div');
        item.className = `command-palette-item ${idx === selectedIndex ? 'selected' : ''}`;
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--color-primary);">${getIcon(cmd.icon)}</span>
            <span style="font-weight: 500;">${cmd.title}</span>
          </div>
          ${cmd.shortcut ? `<span class="command-palette-shortcut">${cmd.shortcut}</span>` : ''}
        `;
        item.addEventListener('mouseenter', () => {
          selectedIndex = idx;
          updateSelection();
        });
        item.addEventListener('click', () => {
          closeCommandPalette();
          cmd.action();
        });
        list.appendChild(item);
      });
    }

    function updateSelection() {
      const items = list.querySelectorAll('.command-palette-item');
      items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const allCmds = getCommands();
      filteredCommands = allCmds.filter(c => c.title.toLowerCase().includes(query) || (c.shortcut && c.shortcut.toLowerCase().includes(query)));
      selectedIndex = 0;
      renderList();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % Math.max(1, filteredCommands.length);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length);
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          closeCommandPalette();
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      }
    });

    paletteOverlay.addEventListener('click', (e) => {
      if (e.target === paletteOverlay) closeCommandPalette();
    });

    renderList();
    setTimeout(() => input.focus(), 10);
  }

  function closeCommandPalette() {
    if (!isPaletteOpen) return;
    if (paletteOverlay) {
      paletteOverlay.remove();
      paletteOverlay = null;
    }
    isPaletteOpen = false;
  }

  // Bind Global Keyboard Shortcut (Ctrl+K or Ctrl+P or Cmd+K)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p' || e.key === 'K' || e.key === 'P')) {
      e.preventDefault();
      if (isPaletteOpen) closeCommandPalette();
      else openCommandPalette();
    }
  });

  global.CommandPalette = { open: openCommandPalette, close: closeCommandPalette };
})(window);
