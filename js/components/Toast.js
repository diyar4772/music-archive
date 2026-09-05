/**
 * Toast notifications.
 *
 * There used to be two competing implementations — one writing into a single
 * `#toast` element, one stacking cards — and `utils.showToast` picked whichever
 * loaded last. This is the only one now; `utils.showToast` delegates here.
 *
 * Messages routinely carry server error text, so they are set with textContent.
 */
import { el } from '../core/dom.js';

const TONES = {
    success: 'border-l-4 border-green-500',
    error: 'border-l-4 border-red-500',
    warning: 'border-l-4 border-amber-500',
    info: 'border-l-4 border-blue-500'
};

let container = null;

function ensureContainer() {
    if (container?.isConnected) return container;
    container = el('div', {
        className: 'fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 pointer-events-none',
        attrs: { id: 'toastContainer', role: 'status', 'aria-live': 'polite' }
    });
    document.body.appendChild(container);
    return container;
}

/**
 * Show a toast.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type]
 * @param {number} [duration] - milliseconds on screen
 * @returns {HTMLElement} the toast node
 */
export function showToast(message, type = 'info', duration = 3000) {
    const host = ensureContainer();

    const card = el('div', {
        className: `toast pointer-events-auto bg-white dark:bg-card-dark text-text-light dark:text-white px-4 py-3 rounded-lg shadow-lg border border-gray-200 dark:border-white/10 ${TONES[type] || TONES.info} flex items-center gap-3 sm:min-w-[280px] max-w-md transition-all duration-200 opacity-0 translate-y-2`
    }, [
        el('span', { className: 'flex-1 text-sm', text: message }),
        el('button', {
            className: 'shrink-0 text-gray-400 hover:text-text-light dark:hover:text-white transition-colors',
            attrs: { type: 'button', 'aria-label': 'Bildirimi kapat' },
            html: '<i class="fa-solid fa-xmark"></i>'
        })
    ]);

    const dismiss = () => {
        card.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => card.remove(), 200);
    };

    card.querySelector('button').addEventListener('click', dismiss);
    host.appendChild(card);
    requestAnimationFrame(() => card.classList.remove('opacity-0', 'translate-y-2'));

    // Keep the stack short so a burst of failures cannot cover the page.
    while (host.children.length > 4) host.firstElementChild.remove();

    setTimeout(dismiss, duration);
    return card;
}

/** Remove every visible toast. */
export function clearToasts() {
    container?.replaceChildren();
}

/**
 * Kept so app.js can create the container up front; showToast() creates it
 * lazily anyway.
 */
export function initToast() {
    ensureContainer();
}
