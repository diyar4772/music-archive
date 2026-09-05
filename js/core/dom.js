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
 * @param {Object} [options.attrs]
 * @param {Object} [options.dataset]
 * @param {Object} [options.on] - event name -> handler
 * @param {(Node|string|null|undefined|false)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    const { className, text, html, attrs, dataset, on } = options;

    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (html !== undefined) node.innerHTML = html;

    for (const [name, value] of Object.entries(attrs || {})) {
        if (value === undefined || value === null || value === false) continue;
        node.setAttribute(name, value === true ? '' : String(value));
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

/**
 * A centred empty/error state block.
 * @param {string} icon - Font Awesome class list
 * @param {string} message
 * @param {string} [tone] - extra classes for the message
 * @returns {HTMLElement}
 */
export function emptyState(icon, message, tone = 'text-text-secondary-light dark:text-text-secondary-dark') {
    return el('div', { className: 'text-center py-12' }, [
        el('i', { className: `${icon} text-4xl text-gray-400 mb-4 block` }),
        el('p', { className: tone, text: message })
    ]);
}

/**
 * A spinner row used while a section loads.
 * @param {string} message
 * @returns {HTMLElement}
 */
export function loadingState(message) {
    return el('div', { className: 'text-center py-12 text-text-secondary-light dark:text-text-secondary-dark' }, [
        el('i', { className: 'fa-solid fa-spinner fa-spin mr-2' }),
        message
    ]);
}

export { PLACEHOLDER_IMAGE };
