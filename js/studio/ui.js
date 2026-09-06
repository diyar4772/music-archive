import { liveText as t } from '../services/i18n.js';
import { el } from '../core/dom.js';

/**
 * Studio controls.
 *
 * Every helper takes its `data-testid` first and requires it: a control the
 * tests cannot address by identity would have to be found by its visible
 * label, and the label changes with the language.
 */

export const button = (testid, text, click, primary = false) => el('button', {
    className: `ma-btn ${primary ? 'ma-btn-primary' : 'ma-btn-secondary'}`,
    text, testid, attrs: { type: 'button' }, on: { click }
});
export function field(label, input) { return el('label', { className: 'studio-field' }, [el('span', { text: label }), input]); }
export const input = (testid, name, placeholder = '', max = 120) => el('input', { className: 'ma-input', testid, attrs: { name, placeholder, maxlength: max } });
export const select = (testid, name, options) => el('select', { className: 'ma-input', testid, attrs: { name } }, options.map(([value, text]) => el('option', { text, attrs: { value } })));
export const time = ms => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
export function notice(text, error = false) { return el('p', { className: `studio-notice${error ? ' is-error' : ''}`, text, attrs: { role: error ? 'alert' : 'status' } }); }

export function page(title, subtitle, children) {
    return el('main', { className: 'ma-main studio-page' }, [
        el('div', { className: 'studio-heading' }, [el('h1', { className: 'ma-page-title', text: title }), el('span', { className: 'ma-badge', text: t('studio.experimental') })]),
        el('p', { className: 'studio-muted', text: subtitle }), ...children
    ]);
}
