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
    const { title, message, icon, iconBg, confirmText, onConfirm } = options;

    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const iconEl = document.getElementById('confirmIcon');
    const confirmBtn = document.getElementById('confirmYesBtn');

    if (titleEl) titleEl.innerText = title || 'Emin misiniz?';
    if (messageEl) messageEl.innerText = message || 'Bu işlemi geri alamazsınız.';

    if (icon && iconEl) {
        iconEl.innerHTML = `<i class="${icon} text-2xl text-white"></i>`;
    }
    if (iconBg && iconEl) {
        iconEl.className = `w-16 h-16 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-4`;
    }

    if (confirmBtn) {
        confirmBtn.innerHTML = `<i class="fa-solid fa-check mr-2"></i>${confirmText || 'Evet, Sil'}`;
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
    // Close modals on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('visible');
            setTimeout(() => e.target.classList.add('hidden'), 300);
        }
    });

    // Expose to global for inline handlers
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.showConfirmModal = showConfirmModal;
    window.closeConfirmModal = closeConfirmModal;
}
