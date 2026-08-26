/**
 * js/icons.js — centralised SVG icon definitions.
 *
 * Usage:  AppIcons.get('save')  → returns an <svg> string.
 * Icons are 18×18, stroke-based, using currentColor so they inherit
 * button/link colour automatically. No fill unless noted.
 *
 * All icons that replace emojis live here so the visual language
 * stays consistent across all application pages.
 */
(function (global) {
  const S = (d, extra) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;" ${extra || ''}>${d}</svg>`;

  const icons = {
    // Navigation
    back:        S('<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>'),
    home:        S('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    projects:    S('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
    settings:    S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    exit:        S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    plus:        S('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    lan:         S('<path d="M5 12H3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2"/><path d="M19 12h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M12 2v4"/><circle cx="12" cy="9" r="3"/><path d="M6.5 15.5a7 7 0 0 0 11 0"/>'),

    // Core Domain Actions
    ocr:         S('<path d="M4 7V4h3M17 4h3v3M4 17v3h3M17 20h3v-3"/><path d="M7 12h10M7 8h10M7 16h6"/>'),
    layout:      S('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
    preprocess:  S('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    edit:        S('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
    save:        S('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
    undo:        S('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
    redo:        S('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>'),
    trash:       S('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>'),
    delete:      S('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>'),
    merge:       S('<path d="M8 6h8"/><path d="M8 18h8"/><path d="M12 6v12"/><path d="M4 12h4"/><path d="M16 12h4"/>'),
    export:      S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    close:       S('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    check:       S('<polyline points="20 6 9 17 4 12"/>'),
    search:      S('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    folder:      S('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
    cpu:         S('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>'),
    sparkles:    S('<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>'),
    tag:         S('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
    keyboard:    S('<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/>'),
    book:        S('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),

    // Table operations
    rowAbove:    S('<rect x="3" y="11" width="18" height="10" rx="1"/><path d="M12 8V2M9 5l3-3 3 3"/>'),
    rowBelow:    S('<rect x="3" y="3" width="18" height="10" rx="1"/><path d="M12 16v6M9 19l3 3 3-3"/>'),
    colLeft:     S('<rect x="11" y="3" width="10" height="18" rx="1"/><path d="M8 12H2M5 9l-3 3 3 3"/>'),
    colRight:    S('<rect x="3" y="3" width="10" height="18" rx="1"/><path d="M16 12h6M19 9l3 3-3 3"/>'),
    splitV:      S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/><path d="M9 9l-2-2 2-2M15 9l2-2-2-2M9 15l-2 2 2 2M15 15l2 2-2 2" opacity=".7"/>'),
    splitH:      S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><path d="M9 9l-2-2 2-2M15 9l2-2-2-2M9 15l-2 2 2 2M15 15l2 2-2 2" opacity=".7"/>'),

    // Layout-editor tools
    select:      S('<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>'),
    move:        S('<path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>'),
    draw:        S('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
    order:       S('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),

    // Status / indicators
    lock:        S('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    globe:       S('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    user:        S('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    info:        S('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    warning:     S('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    clock:       S('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    eye:         S('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    dashboard:   S('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    preview:     S('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    quran:       S('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/>'),

    // Direction arrows
    prev:        S('<polyline points="15 18 9 12 15 6"/>'),
    next:        S('<polyline points="9 18 15 12 9 6"/>'),
    chevronLeft: S('<polyline points="15 18 9 12 15 6"/>'),
    chevronRight:S('<polyline points="9 18 15 12 9 6"/>'),
    arrowLeft:   S('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
    arrowRight:  S('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
    collapseRTL: S('<path d="M15 18l-6-6 6-6"/>'),
    expandRTL:   S('<path d="M9 18l6-6-6-6"/>'),

    // Misc
    scan:        S('<path d="M3 3h4v4H3z"/><path d="M17 3h4v4h-4z"/><path d="M3 17h4v4H3z"/><path d="M21 21h-4v-4"/><path d="M9 3h6"/><path d="M9 21h6"/><path d="M3 9v6"/><path d="M21 9v6"/>'),
    network:     S('<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>'),
    batch:       S('<rect x="2" y="7" width="16" height="14" rx="2"/><path d="M6 3h14a2 2 0 0 1 2 2v12"/>'),
    crop:        S('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
  };

  const AppIcons = {
    /**
     * Returns the raw SVG string for `name`.
     * Falls back to a placeholder square if the icon doesn't exist.
     */
    get(name, extraStyle = '') {
      const fn = icons[name];
      if (fn) {
        if (extraStyle) {
          return fn.replace('<svg ', `<svg style="${extraStyle}" `);
        }
        return fn;
      }
      return S('<rect x="3" y="3" width="18" height="18" rx="2"/>');
    },
    /**
     * Injects an icon into every element matching `selector`.
     * Prepends the icon before any existing text content.
     */
    inject(selector, name) {
      document.querySelectorAll(selector).forEach(el => {
        if (!el.querySelector('svg')) {
          el.insertAdjacentHTML('afterbegin', AppIcons.get(name) + ' ');
        }
      });
    },
  };

  global.AppIcons = AppIcons;
})(window);
