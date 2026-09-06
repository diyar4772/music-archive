import { liveText as t } from '../services/i18n.js';
import { el } from '../core/dom.js';

export const button = (text, click, primary = false) => el('button', {
    className: `ma-btn ${primary ? 'ma-btn-primary' : 'ma-btn-secondary'}`,
    text, attrs: { type: 'button' }, on: { click }
});
export function field(label, input) { return el('label', { className: 'studio-field' }, [el('span', { text: label }), input]); }
export const input = (name, placeholder = '', max = 120) => el('input', { className: 'ma-input', attrs: { name, placeholder, maxlength: max } });
export const select = (name, options) => el('select', { className: 'ma-input', attrs: { name } }, options.map(([value, text]) => el('option', { text, attrs: { value } })));
export const time = ms => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
export function notice(text, error = false) { return el('p', { className: `studio-notice${error ? ' is-error' : ''}`, text, attrs: { role: error ? 'alert' : 'status' } }); }

export function page(title, subtitle, children) {
    return el('main', { className: 'ma-main studio-page' }, [
        el('div', { className: 'studio-heading' }, [el('h1', { className: 'ma-page-title', text: title }), el('span', { className: 'ma-badge', text: t('studio.experimental') })]),
        el('p', { className: 'studio-muted', text: subtitle }), ...children
    ]);
}
