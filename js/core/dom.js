import { setText } from '../services/i18n.js';
/**
 * Safe DOM construction helpers.
 *
 * Every list in this app renders names that come from Spotify or from another
 * user (playlist names, usernames). Building those rows with template strings
 * and `innerHTML` made each one an injection point, so views build nodes here
 * instead: text always goes through `textContent`, and only class names and
 * fixed markup are ever written as HTML.
 */

const PLACEHOLDER_IMAGE = '/js/placeholder.svg';

/**
 * Escape a value for the rare case where interpolation into markup is
 * unavoidable (an attribute inside an otherwise static template).
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Create an element.
 * @param {string} tag
 * @param {Object} [options]
 * @param {string} [options.className]
 * @param {string} [options.text] - written with textContent, never parsed
 * @param {string} [options.html] - static markup only; never pass user data
 * @param {string} [options.style] - inline declarations; author-written only
 * @param {Object} [options.attrs]
 * @param {Object} [options.dataset]
 * @param {Object} [options.on] - event name -> handler
 * @param {(Node|string|null|undefined|false)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    const { className, text, html, style, attrs, dataset, on } = options;

    if (className) node.className = className;
    if (text !== undefined && text !== null) setText(node, text);
    if (html !== undefined) node.innerHTML = html;
    if (style) node.style.cssText = style;

    for (const [name, value] of Object.entries(attrs || {})) {
        if (value === undefined || value === null || value === false) continue;
        node.setAttribute(name, value === true ? '' : String(value));
        if (value?.translationKey) {
            const binding = { 'aria-label': 'aria', placeholder: 'placeholder', title: 'title' }[name];
            if (binding) node.setAttribute(`data-lang-${binding}`, value.translationKey);
        }
    }
    for (const [name, value] of Object.entries(dataset || {})) {
        if (value === undefined || value === null) continue;
        node.dataset[name] = String(value);
    }
    for (const [event, handler] of Object.entries(on || {})) {
        node.addEventListener(event, handler);
    }

    for (const child of [].concat(children)) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }

    return node;
}

/**
 * An <img> that falls back to the bundled placeholder, both when the source is
 * missing and when the remote image fails to load. Only http(s) and same-origin
 * paths are accepted so a `javascript:` or `data:` URL from an API response can
 * never reach the src attribute.
 * @param {string|null|undefined} src
 * @param {string} className
 * @param {string} [alt]
 * @returns {HTMLImageElement}
 */
export function img(src, className, alt = '') {
    const node = document.createElement('img');
    node.className = className;
    node.alt = alt;
    node.loading = 'lazy';
    node.src = safeImageUrl(src);
    node.addEventListener('error', () => {
        if (node.src !== new URL(PLACEHOLDER_IMAGE, location.origin).href) {
            node.src = PLACEHOLDER_IMAGE;
        }
    });
    return node;
}

/**
 * @param {string|null|undefined} value
 * @returns {string} the value when it is a safe image URL, else the placeholder
 */
export function safeImageUrl(value) {
    if (typeof value !== 'string' || !value) return PLACEHOLDER_IMAGE;
    if (value.startsWith('/')) return value;
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(value)) return value;
    try {
        const url = new URL(value, location.origin);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : PLACEHOLDER_IMAGE;
    } catch {
        return PLACEHOLDER_IMAGE;
    }
}

/**
 * Replace a container's children with the given nodes.
 * @param {Element|null} container
 * @param {...(Node|null|undefined|false)} nodes
 */
export function replace(container, ...nodes) {
    if (!container) return;
    container.replaceChildren(...nodes.filter(Boolean));
}

/* ── design-system pieces ───────────────────────────────────────────────── */

const ACCENTS = ['var(--violet)', 'var(--pink)', 'var(--cyan)', 'var(--violet-l)', 'var(--pink-d)'];

/**
 * A stable accent for a name, so the same artist keeps the same tile colour
 * across renders and reloads.
 * @param {string} [name]
 * @returns {string} a hex colour
 */
export function accentFor(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return ACCENTS[hash % ACCENTS.length];
}

/** @param {string} [name] @returns {string} the first character, upper-cased */
export function initialOf(name = '') {
    return (name.trim()[0] || '?').toLocaleUpperCase('tr-TR');
}

/**
 * An artwork tile. The initial and its accent are painted first and the remote
 * image is layered over them as a background, so a missing or broken cover
 * degrades to the coloured initial instead of a grey placeholder.
 * @param {string|null|undefined} src
 * @param {string} name - used for the initial, the accent and the label
 * @param {string} [size] - one of the ma-cover-* modifiers
 * @param {Object} [options]
 * @param {string} [options.tag] - element name, e.g. 'button'
 * @param {Object} [options.attrs]
 * @param {Object} [options.on]
 * @param {string} [options.className] - extra classes
 * @returns {HTMLElement}
 */
export function cover(src, name, size = 'ma-cover-sm', options = {}) {
    return artwork(src, name, `ma-cover ${size}`, options);
}

/**
 * The round variant, for artists and account avatars.
 * @param {string|null|undefined} src
 * @param {string} name
 * @param {string} [size] - one of the ma-avatar-* modifiers
 * @param {Object} [options] - same shape as cover()
 * @returns {HTMLElement}
 */
export function avatar(src, name, size = 'ma-avatar-sm', options = {}) {
    return artwork(src, name, `ma-avatar ${size}`, options);
}

function artwork(src, name, baseClass, { tag = 'span', attrs = {}, on = {}, className = '' } = {}) {
    const node = el(tag, {
        className: `${baseClass} ${className}`.trim(),
        text: initialOf(name),
        attrs: { 'aria-hidden': 'true', ...attrs },
        on
    });
    node.style.setProperty('--art-accent', accentFor(name));

    const url = safeImageUrl(src);
    if (url === PLACEHOLDER_IMAGE) return node;

    // Probe the artwork off-document rather than swapping straight to it: the
    // initial has to stay visible when the URL 404s, and a background image
    // would otherwise sit *under* the letter and show both at once.
    const probe = new Image();
    probe.addEventListener('load', () => {
        // Setting through CSSOM means an unparseable value is dropped rather
        // than written into the document, and safeImageUrl has already rejected
        // anything that is not http(s), same-origin or a data: image.
        node.style.backgroundImage = `url("${url}")`;
        node.textContent = '';
    });
    probe.src = url;

    return node;
}

/**
 * "★★★☆☆" for a 0–5 rating, or an em dash when nothing is rated yet.
 * @param {number|null|undefined} rating
 * @returns {HTMLElement}
 */
export function stars(rating) {
    const value = Math.round(Number(rating) || 0);
    if (!value) return el('span', { className: 'ma-stars ma-stars-dim', text: '—' });
    return el('span', { className: 'ma-stars', text: '★'.repeat(value) + '☆'.repeat(5 - value) });
}

/**
 * The small uppercase label that heads every section in the design.
 * @param {string} text
 * @param {string} [extraClass]
 * @returns {HTMLElement}
 */
export function kicker(text, extraClass = '') {
    return el('div', { className: `ma-kicker ${extraClass}`.trim(), text });
}

/**
 * Render an icon: a Font Awesome class list becomes an <i>, anything else is
 * treated as a literal glyph such as ♥ or ⌕.
 * @param {string} icon
 * @returns {HTMLElement|string}
 */
export function glyph(icon) {
    return icon.startsWith('fa-') ? el('i', { className: icon, attrs: { 'aria-hidden': 'true' } }) : icon;
}

export { PLACEHOLDER_IMAGE };
