// ── Alibi Eldritch Text Decoder ──────────────────────────────────────────────
// Finds all 「 」 blocks in character messages and animates them from
// scrambled eldritch characters → English, left to right.

(function () {
    'use strict';

    // ── Eldritch character pool ──────────────────────────────────────────────
    // Runic + archaic Unicode blocks chosen for visual "wrongness"
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
        let live = true;

        // Each character gets a window: [start frame → end frame]
        // start is staggered left-to-right so decoding flows horizontally
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
    const settleTimers = new Map();

    function processMessage(mesText) {
        if (!mesText || mesText.dataset.alibiDone) return;

        // Use a "settle" debounce to wait for streaming to stop
        if (settleTimers.has(mesText)) {
            clearTimeout(settleTimers.get(mesText));
        }

        const timer = setTimeout(() => {
            settleTimers.delete(mesText);

            // Re-check for done and content
            if (mesText.dataset.alibiDone) return;
            const original = mesText.innerHTML;
            if (!original.includes('「')) return;

            // Optional: Skip if still streaming (common SillyTavern classes)
            const mes = mesText.closest('.mes');
            if (mes && (mes.classList.contains('streaming') || mes.querySelector('.typing-indicator'))) {
                processMessage(mesText); // Check again later
                return;
            }

            mesText.dataset.alibiDone = '1';

            // Replace every 「...」 block with a bracket span + empty target span
            const replaced = original.replace(/「([^」]*)」/g, (_, inner) => {
                const tmp = document.createElement('div');
                tmp.innerHTML = inner;
                const plain = tmp.textContent || '';
                const id = 'al-' + Math.random().toString(36).slice(2, 10);

                return `<span class="alibi-bracket">「</span>`
                    + `<span class="alibi-text" id="${id}" data-t="${encodeURIComponent(plain)}"></span>`
                    + `<span class="alibi-bracket">」</span>`;
            });

            if (replaced === original) {
                delete mesText.dataset.alibiDone;
                return;
            }

            mesText.innerHTML = replaced;

            // Fire each 「」 block in sequence
            mesText.querySelectorAll('.alibi-text[data-t]').forEach((span, i) => {
                const text = decodeURIComponent(span.getAttribute('data-t'));
                setTimeout(() => scramble(span, text), i * 280 + 380);
            });
        }, 400); // 400ms settle time

        settleTimers.set(mesText, timer);
    }

    // ── Watch for new messages and content changes ──────────────────────────
    function watch() {
        const chat = document.getElementById('chat');
        if (!chat) { setTimeout(watch, 800); return; }

        // Observe both new messages AND content changes within messages
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                // Handle new nodes
                if (m.addedNodes.length) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;

                        // New message added
                        if (node.classList.contains('mes')) {
                            const mt = node.querySelector('.mes_text');
                            if (mt) processMessage(mt);
                        }
                        // Or if the node itself is mes_text (rare but possible)
                        else if (node.classList.contains('mes_text')) {
                            processMessage(node);
                        }
                        // Or if content was added deep inside a message
                        else {
                            const mt = node.closest('.mes_text') || node.querySelector('.mes_text');
                            if (mt) processMessage(mt);
                        }
                    }
                }

                // Handle text content changes (for streaming)
                if (m.type === 'characterData' || m.type === 'childList') {
                    const mt = m.target.nodeType === 1
                        ? (m.target.closest('.mes_text') || m.target.querySelector('.mes_text'))
                        : m.target.parentElement?.closest('.mes_text');

                    if (mt) processMessage(mt);
                }
            }
        });

        observer.observe(chat, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Initial sweep: only process the LATEST message on startup
        const messages = document.querySelectorAll('.mes_text');
        if (messages.length > 0) {
            processMessage(messages[messages.length - 1]);
        }

        console.log('[alibi-eldritch] ✓ active (robust mode)');
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', watch)
        : watch();

})();
