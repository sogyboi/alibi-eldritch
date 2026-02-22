// ── Alibi Eldritch Text Decoder ──────────────────────────────────────────────
// Finds all 「 」 blocks in character messages and places a decode button
// next to them. Clicking the button animates scrambled → English, left to right.
// Settings panel in the Extensions tab for customization and debug tools.

import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const MODULE_NAME = 'alibi_eldritch_decoder';
// Auto-detect the extension folder path from the script's own URL
const extensionFolderPath = new URL('.', import.meta.url).pathname.replace(/^\//, '').replace(/\/$/, '');

// ── Default settings ─────────────────────────────────────────────────────────
const defaultSettings = Object.freeze({
    speed: 1.0,
    glow: true,
    autoDecodeNew: false,
    buttonSymbol: '⦻',
    debugLog: false,
    showKeys: false,
});

function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extension_settings[MODULE_NAME], key)) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE_NAME];
}

function debugLog(...args) {
    if (getSettings().debugLog) {
        console.log('[alibi-eldritch]', ...args);
    }
}

// ── Eldritch character pool ──────────────────────────────────────────────────
const ELDRITCH = [
    'ᚠ', 'ᚡ', 'ᚢ', 'ᚣ', 'ᚤ', 'ᚥ', 'ᚦ', 'ᚧ', 'ᚨ', 'ᚩ', 'ᚪ', 'ᚫ', 'ᚬ', 'ᚭ', 'ᚮ', 'ᚯ',
    'ᚰ', 'ᚱ', 'ᚲ', 'ᚳ', 'ᚴ', 'ᚵ', 'ᚶ', 'ᚷ', 'ᚸ', 'ᚹ', 'ᚺ', 'ᚻ', 'ᚼ', 'ᚽ', 'ᚾ', 'ᚿ',
    'ᛀ', 'ᛁ', 'ᛂ', 'ᛃ', 'ᛄ', 'ᛅ', 'ᛆ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛋ', 'ᛌ', 'ᛍ', 'ᛎ', 'ᛏ',
    'ᛐ', 'ᛑ', 'ᛒ', 'ᛓ', 'ᛔ', 'ᛕ', 'ᛖ', 'ᛗ', 'ᛘ', 'ᛙ', 'ᛚ', 'ᛛ', 'ᛜ', 'ᛝ', 'ᛞ', 'ᛟ',
    'ᛠ', 'ᛡ', 'ᛪ', '꒐', '꒑', '꒒', '꒓', '꒔', '꒕', '꒖', '꒗', '꒘', '꒙', '꒚', '꒛',
    '꒜', '꒝', '꒞', '꒟', '꒠', '꒡', '꒢', '꒣', '꒤', '꒥', '꒦', '꒧', '꒨', '꒩', '꒪',
    '꒫', '꒬', '꒭', '꒮', '꒯'
];

function randChar() {
    return ELDRITCH[Math.floor(Math.random() * ELDRITCH.length)];
}

function isPassthrough(c) {
    return /[\s.,!?;:'"—–\-()\n]/.test(c);
}

function safe(c) {
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '&') return '&amp;';
    return c;
}

// ── Persistence (localStorage) ───────────────────────────────────────────────
const STORAGE_KEY = 'alibi-decoded';

function getDecoded() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
}

function unmarkDecoded(key) {
    const data = getDecoded();
    delete data[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    debugLog('Cleared decoded key:', key);
}

function markDecoded(key) {
    const data = getDecoded();
    data[key] = 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    debugLog('Saved decoded key:', key);
}

function clearAllDecoded() {
    localStorage.removeItem(STORAGE_KEY);
    debugLog('Cleared all decoded state');
}

function blockKey(mesText, blockIndex) {
    const mes = mesText.closest('.mes');
    const mesId = mes?.getAttribute('mesid') || mes?.dataset.mesid || mes?.id || '??';
    return mesId + ':' + blockIndex;
}

// ── Core animation ───────────────────────────────────────────────────────────
function scramble(el, text, onComplete) {
    const settings = getSettings();
    const speedMultiplier = settings.speed;
    const chars = [...text];
    let frame = 0;
    let live = true;

    const schedule = chars.map((char, i) => {
        if (isPassthrough(char)) {
            return { char, start: 0, end: 0, current: char };
        }
        const start = Math.floor(i * 0.55 / speedMultiplier);
        const end = start + Math.floor((Math.random() * 20 + 10) / speedMultiplier);
        return { char, start, end, current: randChar() };
    });

    const glowEnabled = settings.glow;

    function tick() {
        if (!live) return;

        let html = '';
        let done = 0;

        for (const s of schedule) {
            if (frame > s.end) {
                done++;
                html += isPassthrough(s.char)
                    ? safe(s.char)
                    : `<span class="alibi-resolved${glowEnabled ? '' : ' alibi-no-glow'}">${safe(s.char)}</span>`;
            } else if (frame >= s.start) {
                if (!isPassthrough(s.char) && Math.random() < 0.4) {
                    s.current = randChar();
                }
                html += `<span class="alibi-scrambling">${safe(s.current)}</span>`;
            } else {
                html += `<span class="alibi-pending">${safe(randChar())}</span>`;
            }
        }

        el.innerHTML = html;
        frame++;

        if (done < chars.length) {
            requestAnimationFrame(tick);
        } else {
            live = false;
            el.textContent = text;
            el.classList.add('alibi-done');
            if (onComplete) onComplete();
        }
    }

    requestAnimationFrame(tick);
}

// ── Generate scrambled placeholder text (static, no animation) ───────────────
function scrambledPreview(text) {
    return [...text].map(c => isPassthrough(c) ? safe(c) : safe(randChar())).join('');
}

// ── Replace 「」 blocks with decode button + scrambled text ────────────────────
function injectButtons(mesText) {
    if (!mesText) return;

    const original = mesText.innerHTML;
    if (!original.includes('「')) {
        mesText.dataset.alibiLastHtml = original; // Still track it to prevent constant re-checking
        return;
    }

    const decoded = getDecoded();
    const settings = getSettings();
    let blockIndex = 0;

    const replaced = original.replace(/「([^」]*)」/g, (_, inner) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = inner;
        const plain = tmp.textContent || '';
        const id = 'al-' + Math.random().toString(36).slice(2, 10);
        const key = blockKey(mesText, blockIndex++);
        const keyLabel = settings.showKeys ? `<span class="alibi-key-label">[${key}]</span>` : '';

        // If already decoded in a previous session, show plain text but STILL SHOW BUTTON
        if (decoded[key]) {
            debugLog('Already decoded (but keeping button):', key);
            return `<span class="alibi-wrapper">`
                + `<button class="alibi-decode-btn alibi-btn-decoded" data-target="${id}" data-key="${key}" title="Toggle eldritch text">${settings.buttonSymbol}</button>`
                + keyLabel
                + `<span class="alibi-bracket">「</span>`
                + `<span class="alibi-text alibi-done" id="${id}" data-t="${encodeURIComponent(plain)}">${plain}</span>`
                + `<span class="alibi-bracket">」</span>`
                + `</span>`;
        }

        // Auto-decode if setting is enabled
        if (settings.autoDecodeNew) {
            markDecoded(key);
            debugLog('Auto-decoding:', key);
            return `<span class="alibi-wrapper">`
                + `<button class="alibi-decode-btn alibi-btn-decoded" data-target="${id}" data-key="${key}" title="Toggle eldritch text">${settings.buttonSymbol}</button>`
                + keyLabel
                + `<span class="alibi-bracket">「</span>`
                + `<span class="alibi-text alibi-auto-decode" id="${id}" data-t="${encodeURIComponent(plain)}"></span>`
                + `<span class="alibi-bracket">」</span>`
                + `</span>`;
        }

        const preview = scrambledPreview(plain);
        return `<span class="alibi-wrapper">`
            + `<button class="alibi-decode-btn" data-target="${id}" data-key="${key}" title="Decode eldritch text">${settings.buttonSymbol}</button>`
            + keyLabel
            + `<span class="alibi-bracket">「</span>`
            + `<span class="alibi-text alibi-scrambled" id="${id}" data-t="${encodeURIComponent(plain)}">${preview}</span>`
            + `<span class="alibi-bracket">」</span>`
            + `</span>`;
    });

    if (replaced === original) {
        mesText.dataset.alibiLastHtml = original;
        return;
    }

    mesText.innerHTML = replaced;
    mesText.dataset.alibiLastHtml = mesText.innerHTML; // Mark the new state as processed

    // Trigger animations for auto-decode spans
    mesText.querySelectorAll('.alibi-auto-decode[data-t]').forEach((span, i) => {
        const text = decodeURIComponent(span.getAttribute('data-t'));
        setTimeout(() => scramble(span, text), i * 280 + 380);
    });

    debugLog('Injected buttons into message');
}

// ── Handle decode button clicks (event delegation) ──────────────────────────
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.alibi-decode-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const targetId = btn.getAttribute('data-target');
    const span = document.getElementById(targetId);
    if (!span) return;

    const key = btn.getAttribute('data-key');
    const fullText = decodeURIComponent(span.getAttribute('data-t') || '');

    // TOGGLE MODE: If already decoded, re-scramble it
    if (span.classList.contains('alibi-done') || span.classList.contains('alibi-auto-decode')) {
        debugLog('Re-scrambling block:', key);
        if (key) unmarkDecoded(key);

        span.classList.remove('alibi-done', 'alibi-auto-decode');
        span.classList.add('alibi-scrambled');
        btn.classList.remove('alibi-btn-decoded');

        span.innerHTML = scrambledPreview(fullText);
        return;
    }

    // DECODE MODE: proceed with animation
    debugLog('Decoding block:', key);
    if (key) markDecoded(key);

    btn.classList.add('alibi-btn-decoded');
    span.classList.remove('alibi-scrambled');
    scramble(span, fullText);
});

// ── Action buttons ──────────────────────────────────────────────────────────

function decodeAll() {
    debugLog('Decode All triggered');
    document.querySelectorAll('.alibi-text.alibi-scrambled[data-t]').forEach(span => {
        const text = decodeURIComponent(span.getAttribute('data-t'));
        span.classList.remove('alibi-scrambled');
        span.textContent = text;
        span.classList.add('alibi-done');

        // Find and hide the button
        const wrapper = span.closest('.alibi-wrapper');
        const btn = wrapper?.querySelector('.alibi-decode-btn');
        if (btn) {
            btn.classList.add('alibi-btn-decoded');
            const key = btn.getAttribute('data-key');
            if (key) markDecoded(key);
        }
    });
}

function rescrambleAll() {
    debugLog('Re-scramble All triggered');
    clearAllDecoded();
    // Re-process all messages by clearing their last HTML state
    document.querySelectorAll('.mes_text').forEach(mt => {
        delete mt.dataset.alibiLastHtml;
    });
    // We need to reload to get the original innerHTML back since we've modified it
    // The cleanest approach is to notify the user
    if (typeof toastr !== 'undefined') {
        toastr.info('Saved state cleared. Refresh the page to see all blocks re-scrambled.', 'Alibi Decoder');
    }
}

function clearSavedState() {
    debugLog('Clear Saved State triggered');
    clearAllDecoded();
    if (typeof toastr !== 'undefined') {
        toastr.success('Decode memory cleared!', 'Alibi Decoder');
    }
}

// ── Watch for new messages ───────────────────────────────────────────────────
const settleTimers = new Map();

function handleMessage(mesText) {
    if (!mesText) return;

    if (settleTimers.has(mesText)) {
        clearTimeout(settleTimers.get(mesText));
    }

    const timer = setTimeout(() => {
        settleTimers.delete(mesText);

        const mes = mesText.closest('.mes');
        if (mes && (mes.classList.contains('streaming') || mes.querySelector('.typing-indicator'))) {
            handleMessage(mesText);
            return;
        }

        const currentHtml = mesText.innerHTML;
        if (mesText.dataset.alibiLastHtml !== currentHtml) {
            injectButtons(mesText);
        }
    }, 500);

    settleTimers.set(mesText, timer);
}

function watch() {
    const chat = document.getElementById('chat');
    if (!chat) { setTimeout(watch, 800); return; }

    // Process all existing messages (just injects buttons — no animation, no lag)
    document.querySelectorAll('.mes_text').forEach(mt => injectButtons(mt));

    // Watch for new messages added to #chat
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (!m.addedNodes.length) continue;
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;

                if (node.classList.contains('mes')) {
                    const mt = node.querySelector('.mes_text');
                    if (mt) handleMessage(mt);
                } else {
                    const mt = node.closest?.('.mes_text') || node.querySelector?.('.mes_text');
                    if (mt) handleMessage(mt);
                }
            }
        }
    });

    observer.observe(chat, { childList: true, subtree: true });

    debugLog('✓ active (click-to-decode mode)');
    console.log('[alibi-eldritch] ✓ active (click-to-decode mode)');
}

// ── Settings UI ──────────────────────────────────────────────────────────────

function loadSettingsUI() {
    const settings = getSettings();

    // Speed slider
    $('#alibi_speed').val(settings.speed);
    $('#alibi_speed_value').text(settings.speed.toFixed(1) + 'x');

    // Checkboxes
    $('#alibi_glow').prop('checked', settings.glow);
    $('#alibi_auto_decode').prop('checked', settings.autoDecodeNew);
    $('#alibi_debug_log').prop('checked', settings.debugLog);
    $('#alibi_show_keys').prop('checked', settings.showKeys);

    // Dropdown
    $('#alibi_symbol').val(settings.buttonSymbol);
}

function bindSettingsEvents() {
    // Speed slider
    $('#alibi_speed').on('input', function () {
        const val = parseFloat($(this).val());
        getSettings().speed = val;
        $('#alibi_speed_value').text(val.toFixed(1) + 'x');
        saveSettingsDebounced();
    });

    // Button symbol
    $('#alibi_symbol').on('change', function () {
        getSettings().buttonSymbol = $(this).val();
        saveSettingsDebounced();
    });

    // Checkboxes
    $('#alibi_glow').on('input', function () {
        getSettings().glow = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#alibi_auto_decode').on('input', function () {
        getSettings().autoDecodeNew = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#alibi_debug_log').on('input', function () {
        getSettings().debugLog = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#alibi_show_keys').on('input', function () {
        getSettings().showKeys = $(this).prop('checked');
        saveSettingsDebounced();
    });

    // Action buttons
    $('#alibi_decode_all').on('click', decodeAll);
    $('#alibi_rescramble_all').on('click', rescrambleAll);
    $('#alibi_clear_state').on('click', clearSavedState);
}

// ── Entry point ──────────────────────────────────────────────────────────────

jQuery(async () => {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $('#extensions_settings2').append(settingsHtml);

    loadSettingsUI();
    bindSettingsEvents();

    watch();
});
