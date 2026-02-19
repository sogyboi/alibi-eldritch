// ── Alibi Eldritch Text Decoder ──────────────────────────────────────────────
// Finds all 「 」 blocks in character messages and animates them from
// scrambled eldritch characters → English, left to right.

(function () {
    'use strict';

    // ── Eldritch character pool ──────────────────────────────────────────────
    // Runic + archaic Unicode blocks chosen for visual "wrongness"
    const ELDRITCH = [
        'ᚠ','ᚡ','ᚢ','ᚣ','ᚤ','ᚥ','ᚦ','ᚧ','ᚨ','ᚩ','ᚪ','ᚫ','ᚬ','ᚭ','ᚮ','ᚯ',
        'ᚰ','ᚱ','ᚲ','ᚳ','ᚴ','ᚵ','ᚶ','ᚷ','ᚸ','ᚹ','ᚺ','ᚻ','ᚼ','ᚽ','ᚾ','ᚿ',
        'ᛀ','ᛁ','ᛂ','ᛃ','ᛄ','ᛅ','ᛆ','ᛇ','ᛈ','ᛉ','ᛊ','ᛋ','ᛌ','ᛍ','ᛎ','ᛏ',
        'ᛐ','ᛑ','ᛒ','ᛓ','ᛔ','ᛕ','ᛖ','ᛗ','ᛘ','ᛙ','ᛚ','ᛛ','ᛜ','ᛝ','ᛞ','ᛟ',
        'ᛠ','ᛡ','ᛪ','꒐','꒑','꒒','꒓','꒔','꒕','꒖','꒗','꒘','꒙','꒚','꒛',
        '꒜','꒝','꒞','꒟','꒠','꒡','꒢','꒣','꒤','꒥','꒦','꒧','꒨','꒩','꒪',
        '꒫','꒬','꒭','꒮','꒯'
    ];

    function randChar() {
        return ELDRITCH[Math.floor(Math.random() * ELDRITCH.length)];
    }

    // Spaces, punctuation, and dashes pass through without scrambling
    function isPassthrough(c) {
        return /[\s.,!?;:'"—–\-()\n]/.test(c);
    }

    // Escape the three HTML special characters
    function safe(c) {
        if (c === '<') return '&lt;';
        if (c === '>') return '&gt;';
        if (c === '&') return '&amp;';
        return c;
    }

    // ── Core animation ───────────────────────────────────────────────────────
    function scramble(el, text) {
        const chars = [...text]; // spread handles multi-byte unicode safely
        let frame = 0;
        let live  = true;

        // Each character gets a window: [start frame → end frame]
        // start is staggered left-to-right so decoding flows horizontally
        const schedule = chars.map((char, i) => {
            if (isPassthrough(char)) {
                return { char, start: 0, end: 0, current: char };
            }
            const start = Math.floor(i * 0.55);
            const end   = start + Math.floor(Math.random() * 20) + 10;
            return { char, start, end, current: randChar() };
        });

        function tick() {
            if (!live) return;

            let html = '';
            let done = 0;

            for (const s of schedule) {

                if (frame > s.end) {
                    // ── Fully resolved ─────────────────────────────────────
                    done++;
                    html += isPassthrough(s.char)
                        ? safe(s.char)
                        : `<span class="alibi-resolved">${safe(s.char)}</span>`;

                } else if (frame >= s.start) {
                    // ── Actively scrambling ────────────────────────────────
                    if (!isPassthrough(s.char) && Math.random() < 0.4) {
                        s.current = randChar();
                    }
                    html += `<span class="alibi-scrambling">${safe(s.current)}</span>`;

                } else {
                    // ── Not yet reached — faint pre-scramble ───────────────
                    html += `<span class="alibi-pending">${safe(randChar())}</span>`;
                }
            }

            el.innerHTML = html;
            frame++;

            if (done < chars.length) {
                requestAnimationFrame(tick);
            } else {
                live = false;
                el.textContent = text;          // clean final state
                el.classList.add('alibi-done');
            }
        }

        requestAnimationFrame(tick);
    }

    // ── Process a single message's .mes_text element ─────────────────────────
    function processMessage(mesText) {
        if (!mesText || mesText.dataset.alibiDone) return;

        const original = mesText.innerHTML;
        if (!original.includes('「')) return;

        mesText.dataset.alibiDone = '1';

        // Replace every 「...」 block with a bracket span + empty target span
        const replaced = original.replace(/「([^」]*)」/g, (_, inner) => {
            // Strip any stray HTML tags SillyTavern may have added inside
            const tmp   = document.createElement('div');
            tmp.innerHTML = inner;
            const plain = tmp.textContent || '';

            const id = 'al-' + Math.random().toString(36).slice(2, 10);

            return `<span class="alibi-bracket">「</span>`
                 + `<span class="alibi-text" id="${id}" data-t="${encodeURIComponent(plain)}"></span>`
                 + `<span class="alibi-bracket">」</span>`;
        });

        if (replaced === original) return;

        mesText.innerHTML = replaced;

        // Fire each 「」 block in sequence with a short stagger
        mesText.querySelectorAll('.alibi-text[data-t]').forEach((span, i) => {
            const text = decodeURIComponent(span.getAttribute('data-t'));
            setTimeout(() => scramble(span, text), i * 280 + 380);
        });
    }

    // ── Watch for new messages ────────────────────────────────────────────────
    function watch() {
        const chat = document.getElementById('chat');
        if (!chat) { setTimeout(watch, 800); return; }

        new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1)                  continue;
                    if (!node.classList.contains('mes'))      continue;

                    const mt = node.querySelector('.mes_text');
                    if (mt) setTimeout(() => processMessage(mt), 120);
                }
            }
        }).observe(chat, { childList: true });

        console.log('[alibi-eldritch] ✓ active');
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', watch)
        : watch();

})();
