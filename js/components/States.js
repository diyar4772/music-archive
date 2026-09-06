import { el, glyph } from '../core/dom.js';
import { liveText as t } from '../services/i18n.js';

const actionButton = action => action instanceof Node ? action : action && el('button', {
    className: 'ma-btn ma-btn-primary ma-state-action', text: action.label,
    testid: 'state-action', attrs: { type: 'button' }, on: { click: action.onClick }
});

export function loading({ rows = 4, label = t('states.loading') } = {}) {
    return el('div', { className: 'ma-state', dataset: { state: 'loading' }, attrs: { 'aria-busy': 'true', 'aria-live': 'polite' } }, [
        el('span', { className: 'ma-sr-only', text: label }),
        ...Array.from({ length: rows }, () => el('div', { className: 'ma-skel-row', attrs: { 'aria-hidden': 'true' } }, [
            el('div', { className: 'ma-skel ma-state-cover' }),
            el('div', { className: 'ma-state-lines' }, [el('div', { className: 'ma-skel ma-state-line' }), el('div', { className: 'ma-skel ma-state-subline' })])
        ]))
    ]);
}

export function empty({ icon = '♪', title, body = '', action = null }) {
    return el('div', { className: 'ma-empty ma-state', dataset: { state: 'empty' }, attrs: { role: 'status' } }, [
        el('div', { className: 'ma-empty-mark', attrs: { 'aria-hidden': 'true' } }, [glyph(icon)]),
        el('div', { className: 'ma-empty-title', text: title }),
        body ? el('div', { className: 'ma-empty-body', text: body }) : null,
        actionButton(action)
    ]);
}

// Only explicitly translated client messages may be displayed; server errors can
// contain internal details or be in a different language from the interface.
export function error({ error: err, retry, title = null }) {
    if (typeof retry !== 'function') throw new TypeError('States.error requires a retry callback');
    const node = empty({ icon: '!', title: title || t('states.errorGeneric'),
        body: err?.translationKey ? t(err.translationKey) : '',
        action: { label: t('states.retry'), onClick: retry } });
    node.dataset.state = 'error';
    node.setAttribute('role', 'alert');
    return node;
}

export function denied({ title = t('states.errorGeneric'), body, action = null }) {
    const node = empty({ icon: '!', title, body, action });
    node.dataset.state = 'denied';
    node.setAttribute('role', 'alert');
    return node;
}

export function signedOut({ body = t('states.signedOutBody'), next = null } = {}) {
    const node = empty({ icon: '♪', title: t('states.signIn'), body,
        action: { label: t('states.signIn'), onClick: () => window.openAuthModal?.('login', { next }) } });
    node.dataset.state = 'signed-out';
    return node;
}
