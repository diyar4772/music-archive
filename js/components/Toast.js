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

const ICONS = {
    success: '✓',
    error: '!',
    warning: '!',
    info: '•'
};

let container = null;

function ensureContainer() {
    if (container?.isConnected) return container;
    container = el('div', {
        className: 'ma-toast-host',
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
    const tone = ICONS[type] ? type : 'info';

    const card = el('div', { className: `ma-toast is-${tone}` }, [
        el('span', { className: 'ma-toast-icon', attrs: { 'aria-hidden': 'true' }, text: ICONS[tone] }),
        el('span', { className: 'ma-flex-1-1-auto', text: message })
    ]);

    const dismiss = () => {
        card.classList.add('is-leaving');
        setTimeout(() => card.remove(), 200);
    };

    card.addEventListener('click', dismiss);
    host.appendChild(card);

    // Keep the stack short so a burst of failures cannot cover the page.
    while (host.children.length > 3) host.firstElementChild.remove();

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
