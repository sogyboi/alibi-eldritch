// ── Alibi Eldritch Text Decoder ──────────────────────────────────────────────
// Finds all 「 」 blocks in character messages and places a decode button
// next to them. Clicking the button animates scrambled → English, left to right.

(function () {
    'use strict';

    // ── Eldritch character pool ──────────────────────────────────────────────
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

    // ── Core animation ───────────────────────────────────────────────────────
    function scramble(el, text) {
        const chars = [...text];
        let frame = 0;
        let live = true;

        const schedule = chars.map((char, i) => {
            if (isPassthrough(char)) {
                return { char, start: 0, end: 0, current: char };
            }
            const start = Math.floor(i * 0.55);
            const end = start + Math.floor(Math.random() * 20) + 10;
            return { char, start, end, current: randChar() };
        });

        function tick() {
            if (!live) return;

            let html = '';
            let done = 0;

            for (const s of schedule) {
                if (frame > s.end) {
                    done++;
                    html += isPassthrough(s.char)
                        ? safe(s.char)
                        : `<span class="alibi-resolved">${safe(s.char)}</span>`;
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
            }
        }

        requestAnimationFrame(tick);
    }

    // ── Generate scrambled placeholder text (static, no animation) ───────────
    function scrambledPreview(text) {
        return [...text].map(c => isPassthrough(c) ? safe(c) : safe(randChar())).join('');
    }

    // ── Replace 「」 blocks with decode button + scrambled text ────────────────
    function injectButtons(mesText) {
        if (!mesText || mesText.dataset.alibiProcessed) return;

        const original = mesText.innerHTML;
        if (!original.includes('「')) return;

        mesText.dataset.alibiProcessed = '1';

        const replaced = original.replace(/「([^」]*)」/g, (_, inner) => {
            const tmp = document.createElement('div');
            tmp.innerHTML = inner;
            const plain = tmp.textContent || '';
            const id = 'al-' + Math.random().toString(36).slice(2, 10);
            const preview = scrambledPreview(plain);

            return `<span class="alibi-wrapper">`
                + `<button class="alibi-decode-btn" data-target="${id}" title="Decode eldritch text">⦻</button>`
                + `<span class="alibi-bracket">「</span>`
                + `<span class="alibi-text alibi-scrambled" id="${id}" data-t="${encodeURIComponent(plain)}">${preview}</span>`
                + `<span class="alibi-bracket">」</span>`
                + `</span>`;
        });

        if (replaced === original) {
            delete mesText.dataset.alibiProcessed;
            return;
        }

        mesText.innerHTML = replaced;
    }

    // ── Handle decode button clicks (event delegation) ──────────────────────
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.alibi-decode-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const targetId = btn.getAttribute('data-target');
        const span = document.getElementById(targetId);
        if (!span || span.classList.contains('alibi-done')) return;

        // Hide the button after clicking
        btn.classList.add('alibi-btn-used');

        const text = decodeURIComponent(span.getAttribute('data-t'));
        span.classList.remove('alibi-scrambled');
        scramble(span, text);
    });

    // ── Watch for new messages ───────────────────────────────────────────────
    const settleTimers = new Map();

    function handleMessage(mesText) {
        if (!mesText || mesText.dataset.alibiProcessed) return;

        // Debounce — wait for streaming to finish
        if (settleTimers.has(mesText)) {
            clearTimeout(settleTimers.get(mesText));
        }

        const timer = setTimeout(() => {
            settleTimers.delete(mesText);
            if (mesText.dataset.alibiProcessed) return;

            const mes = mesText.closest('.mes');
            if (mes && (mes.classList.contains('streaming') || mes.querySelector('.typing-indicator'))) {
                handleMessage(mesText);
                return;
            }

            injectButtons(mesText);
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

        console.log('[alibi-eldritch] ✓ active (click-to-decode mode)');
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', watch)
        : watch();

})();
