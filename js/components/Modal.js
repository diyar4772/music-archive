import { t } from '../services/i18n.js';
// Modal Controller
// Generic modal open/close with animations

/**
 * Open a modal by ID
 * @param {string} modalId - Modal element ID
 * @param {string} contentId - Optional content element ID for animation
 */
export function openModal(modalId, contentId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('hidden');

    // Animate content if provided
    if (contentId) {
        const content = document.getElementById(contentId);
        if (content) {
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }
    } else {
        setTimeout(() => modal.classList.add('visible'), 10);
    }
}

/**
 * Close a modal by ID
 * @param {string} modalId - Modal element ID
 * @param {string} contentId - Optional content element ID for animation
 */
export function closeModal(modalId, contentId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Animate content if provided
    if (contentId) {
        const content = document.getElementById(contentId);
        if (content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
        }
    } else {
        modal.classList.remove('visible');
    }

    setTimeout(() => modal.classList.add('hidden'), 300);
}

/**
 * Show confirmation modal
 * @param {Object} options - Confirmation options
 */
export function showConfirmModal(options) {
    const { title, message, icon, confirmText, onConfirm } = options;

    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const iconEl = document.getElementById('confirmIcon');
    const confirmBtn = document.getElementById('confirmYesBtn');

    if (titleEl) titleEl.textContent = title || t('confirm.title');
    if (messageEl) messageEl.textContent = message || t('confirm.body');

    if (iconEl) {
        // Swap the glyph, keep the mark. This used to overwrite the element's
        // class with Tailwind utilities, which put a blue-red gradient circle
        // in the middle of a dialog built from the design tokens.
        const glyph = document.createElement('i');
        glyph.className = icon || 'fa-solid fa-trash';
        iconEl.replaceChildren(glyph);
        iconEl.className = 'ma-notice-mark ma-m-0-auto';
    }

    if (confirmBtn) {
        const check = document.createElement('i');
        // .ma-btn lays its children out with gap, so no margin utility here.
        check.className = 'fa-solid fa-check';
        confirmBtn.replaceChildren(check, document.createTextNode(confirmText || t('confirm.delete')));
        confirmBtn.onclick = () => {
            if (onConfirm) onConfirm();
            closeConfirmModal();
        };
    }

    openModal('confirmModal', 'confirmModalContent');
}

/**
 * Close confirmation modal
 */
export function closeConfirmModal() {
    closeModal('confirmModal', 'confirmModalContent');
}

/**
 * Initialize modal close handlers
 */
export function initModals() {
    const focusable = modal => [...modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
        .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const activeModal = () => [...document.querySelectorAll('.modal:not(.hidden)')]
        .filter(node => getComputedStyle(node).display !== 'none')
        .sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1);
    let active = null;
    const openers = new WeakMap();
    const observer = new MutationObserver(() => {
        const next = activeModal();
        if (next === active) return;
        if (active && !next) openers.get(active)?.focus?.();
        if (next) {
            if (!openers.has(next) || !active) openers.set(next, document.activeElement);
            next.setAttribute('role', 'dialog');
            next.setAttribute('aria-modal', 'true');
            if (!next.contains(document.activeElement)) focusable(next)[0]?.focus();
        }
        active = next;
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', event => {
        const modal = activeModal();
        if (!modal) return;
        if (event.key === 'Escape') { event.preventDefault(); closeModal(modal.id); return; }
        if (event.key !== 'Tab') return;
        const nodes = focusable(modal), first = nodes[0], last = nodes.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    });
    // Close modals on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('visible');
            setTimeout(() => e.target.classList.add('hidden'), 300);
        }
    });
}
