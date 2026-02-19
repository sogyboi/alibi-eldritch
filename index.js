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

    // ── Watch for new messages ────────────────────────────────────────────────

    // Track which message IDs we've already seen so we never re-process them
    const knownMessageIds = new Set();

    // Record every message currently in the DOM as "known" (won't be animated)
    function snapshotExisting() {
        document.querySelectorAll('#chat > .mes').forEach(mes => {
            const id = mes.getAttribute('mesid') || mes.dataset.mesid || mes.id || null;
            if (id) knownMessageIds.add(id);
            // Also mark the text element so processMessage won't touch it
            const mt = mes.querySelector('.mes_text');
            if (mt) mt.dataset.alibiDone = '1';
        });
    }

    // For a genuinely new message, watch its .mes_text for streaming updates
    function watchMessageForStreaming(mesText) {
        const streamObs = new MutationObserver(() => {
            // Re-process whenever content changes (debounced inside processMessage)
            if (mesText.dataset.alibiDone) return;
            processMessage(mesText);
        });
        streamObs.observe(mesText, { childList: true, characterData: true, subtree: true });

        // Auto-disconnect after 60s to avoid leaks on long sessions
        setTimeout(() => streamObs.disconnect(), 60000);
    }

    function watch() {
        const chat = document.getElementById('chat');
        if (!chat) { setTimeout(watch, 800); return; }

        // Snapshot everything currently loaded
        snapshotExisting();

        // Main observer: ONLY watch direct children of #chat (no subtree!)
        // This fires once per new .mes div, not for every tiny DOM change inside messages
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (!m.addedNodes.length) continue;
                for (const node of m.addedNodes) {
                    if (node.nodeType !== 1 || !node.classList.contains('mes')) continue;

                    const id = node.getAttribute('mesid') || node.dataset.mesid || node.id || null;

                    // If we've seen this message before (old message re-added), skip it
                    if (id && knownMessageIds.has(id)) {
                        const mt = node.querySelector('.mes_text');
                        if (mt) mt.dataset.alibiDone = '1';
                        continue;
                    }

                    // Record this as a known message
                    if (id) knownMessageIds.add(id);

                    const mt = node.querySelector('.mes_text');
                    if (mt) {
                        processMessage(mt);
                        watchMessageForStreaming(mt);
                    }
                }
            }
        });

        observer.observe(chat, { childList: true, subtree: false });

        // Animate only the very last message on startup (after a short delay
        // to let SillyTavern finish rendering its content)
        setTimeout(() => {
            const allMessages = document.querySelectorAll('#chat > .mes');
            if (allMessages.length > 0) {
                const lastMes = allMessages[allMessages.length - 1];
                const mt = lastMes.querySelector('.mes_text');
                if (mt) {
                    delete mt.dataset.alibiDone;
                    processMessage(mt);
                }
            }
            console.log('[alibi-eldritch] ✓ active (processing new messages only)');
        }, 2000);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', watch)
        : watch();

})();
