/**
 * Header.
 *
 * The sticky bar from the design canvas: brand mark, section nav, language
 * switcher, theme toggle and the account menu. Everything is built as DOM
 * nodes — the username is text the account holder chose, never markup.
 */
import { Component } from '../core/Component.js';
import { store } from '../state/store.js';
import { isAuthenticated, getCurrentUser } from '../services/auth.js';
import i18n, { t, changeLanguage } from '../services/i18n.js';
import { el, initialOf } from '../core/dom.js';
import { showToast } from '../utils.js';

const LANGUAGES = ['tr', 'en', 'ku'];

const SECTIONS = [
    { id: 'dashboard', key: 'nav.archive' },
    { id: 'studio', key: 'nav.studio' },
    { id: 'recordings', key: 'nav.recordings' },
    { id: 'pieces', key: 'nav.pieces' }
];

const MENU_ITEMS = [
    { action: 'likes', key: 'library.likedSongs', icon: 'fa-solid fa-heart', color: 'var(--pink-ink)' },
    { action: 'follows', key: 'library.following', icon: 'fa-solid fa-user', color: 'var(--violet-ink)' },
    { action: 'playlists', key: 'library.playlists', icon: 'fa-solid fa-list', color: 'var(--cyan-ink)' },
    { action: 'create-playlist', key: 'library.createPlaylist', icon: 'fa-solid fa-plus', color: 'var(--ink3)' },
    { action: 'settings', key: 'settings.title', icon: 'fa-solid fa-gear', color: 'var(--ink3)' },
    { action: 'logout', key: 'common.logout', icon: 'fa-solid fa-arrow-right-from-bracket', color: 'var(--err-ink)' }
];

export class Navbar extends Component {
    constructor(container, props = {}) {
        super(container, props);
        this.onLogout = props.onLogout || (() => {});
        this.onShowDashboard = props.onShowDashboard || (() => {});
        this.onToggleTheme = props.onToggleTheme || (() => {});
        this.onOpenProfileModal = props.onOpenProfileModal || (() => {});
        this.onCreatePlaylist = props.onCreatePlaylist || (() => {});
        this.onOpenSettings = props.onOpenSettings || (() => {});
        this.menuOpen = false;
        this.onDocumentClick = event => {
            if (this.menuOpen && !event.target.closest('.ma-account')) this.closeMenu();
        };
    }

    /** @returns {string} the route the header should highlight */
    activeSection() {
        const route = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard');
        return SECTIONS.some(s => s.id === route) ? route : 'dashboard';
    }

    render() {
        const isAuth = isAuthenticated();
        const user = getCurrentUser();
        const active = this.activeSection();
        const isDark = (store.currentTheme || 'dark') !== 'light';

        const header = el('header', { className: 'ma-header' }, [
            el('div', { className: 'ma-header-inner' }, [
                el('button', {
                    className: 'ma-brand',
                    attrs: { type: 'button', 'aria-label': t('nav.home') },
                    on: { click: () => this.onShowDashboard() }
                }, [
                    el('span', { className: 'ma-mark', attrs: { 'aria-hidden': 'true' } }),
                    el('span', { className: 'ma-brand-name', text: 'Music Archive' })
                ]),

                el('nav', { className: 'ma-nav', attrs: { 'aria-label': t('nav.sections') } },
                    SECTIONS.map(section => el('button', {
                        className: `ma-navbtn${section.id === active ? ' is-active' : ''}`,
                        text: t(section.key),
                        attrs: {
                            type: 'button',
                            'aria-current': section.id === active ? 'page' : null
                        },
                        on: { click: () => this.goTo(section.id) }
                    }))),

                el('div', { className: 'ma-header-tools' }, [
                    el('div', { className: 'ma-seg', attrs: { role: 'group', 'aria-label': t('settings.language') } },
                        LANGUAGES.map(code => el('button', {
                            className: `ma-segbtn${code === i18n.language ? ' is-active' : ''}`,
                            text: code.toUpperCase(),
                            attrs: { type: 'button', 'aria-pressed': String(code === i18n.language) },
                            on: { click: () => changeLanguage(code) }
                        }))),

                    el('button', {
                        className: 'ma-iconbtn',
                        attrs: { type: 'button', title: t('nav.toggleTheme'), 'aria-label': t('nav.toggleTheme') },
                        on: { click: () => this.onToggleTheme() }
                    }, [el('i', { className: isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun' })]),

                    isAuth && user ? this.accountControl(user) : el('button', {
                        className: 'ma-btn ma-btn-primary ma-btn-sm',
                        text: t('auth.login'),
                        attrs: { type: 'button' },
                        on: { click: () => window.openAuthModal?.() }
                    })
                ])
            ])
        ]);

        if (active === 'dashboard') {
            header.append(el('nav', { className: 'studio-subnav', attrs: { 'aria-label': t('nav.archive') } },
                ['dashboard', 'search', 'library', 'dig'].map(id => el('button', {
                    className: 'ma-navbtn', text: t(`nav.${id}`), attrs: { type: 'button' },
                    on: { click: () => this.goTo(id) }
                }))));
        }
        const focus = this.container.contains(document.activeElement) ? document.activeElement : null;
        const focusLabel = focus?.getAttribute('aria-label');
        const focusText = focus?.textContent;
        this.container.replaceChildren(header);
        if (focus) [...header.querySelectorAll('button')].find(node => focusLabel ? node.getAttribute('aria-label') === focusLabel : node.textContent === focusText)?.focus();
        header.addEventListener('keydown', event => {
            if (!this.menuOpen) return;
            const items = [...header.querySelectorAll('[role=menuitem]')];
            const index = items.indexOf(document.activeElement);
            if (event.key === 'Escape') { event.preventDefault(); this.closeMenu(); this.querySelector('[aria-haspopup=menu]')?.focus(); }
            else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
            }
        });
    }

    /**
     * @param {string} user - the account's username
     * @returns {HTMLElement}
     */
    accountControl(user) {
        return el('div', { className: 'ma-account ma-position-relative', }, [
            el('button', {
                className: 'ma-iconbtn ma-w-auto ma-p-0-8-0-4 ma-gap-8 ma-color-ink',
                attrs: {
                    type: 'button',
                    'aria-haspopup': 'menu',
                    'aria-expanded': String(this.menuOpen),
                    'aria-label': `${user} — ${t('nav.accountMenu')}`
                },
                on: { click: event => { event.stopPropagation(); this.toggleMenu(); } }
            }, [
                el('span', {
                    className: 'ma-avatar ma-avatar-xs ma-avatar-brand',
                    text: initialOf(user),
                    attrs: { 'aria-hidden': 'true' }
                }),
                el('span', { className: 'ma-text-12 ma-color-ink2', text: '▾' })
            ]),
            this.menuOpen ? this.accountMenu(user) : null
        ]);
    }

    /**
     * @param {string} user
     * @returns {HTMLElement}
     */
    accountMenu(user) {
        return el('div', { className: 'ma-menu', attrs: { role: 'menu' } }, [
            el('div', { className: 'ma-menu-head' }, [
                el('div', { className: 'ma-text-13 ma-weight-600', text: user }),
                el('div', { className: 'ma-kicker ma-mt-4',  text: t('nav.accountMenu') })
            ]),
            ...MENU_ITEMS.map(item => el('button', {
                className: `ma-menu-item${item.action === 'logout' ? ' is-danger' : ''}`,
                attrs: { type: 'button', role: 'menuitem' },
                on: { click: event => { event.stopPropagation(); this.handleMenuAction(item.action); } }
            }, [
                el('span', { text: t(item.key) }),
                el('i', { className: `${item.icon} ma-dynamic-accent`, style: `--accent:${item.color}`, attrs: { 'aria-hidden': 'true' } })
            ]))
        ]);
    }

    /** @param {string} section */
    goTo(section) {
        this.closeMenu();
        window.router?.navigate(section === 'dashboard' ? 'dashboard' : section);
    }

    toggleMenu() {
        this.menuOpen = !this.menuOpen;
        this.render();
        if (this.menuOpen) this.querySelector('[role=menuitem]')?.focus();
    }

    closeMenu() {
        if (!this.menuOpen) return;
        this.menuOpen = false;
        this.render();
    }

    /** @param {string} action */
    handleMenuAction(action) {
        this.closeMenu();
        switch (action) {
            case 'likes':
            case 'follows':
            case 'playlists':
                this.onOpenProfileModal(action);
                break;
            case 'create-playlist':
                this.onCreatePlaylist();
                break;
            case 'settings':
                this.onOpenSettings();
                break;
            case 'logout':
                void this.handleLogout();
                break;
        }
    }

    async handleLogout() {
        try {
            await this.onLogout();
            this.render();
        } catch (error) {
            console.error('Logout error:', error);
            showToast(t('common.error'), 'error');
        }
    }

    onMount() {
        // The account control changes shape when the session does.
        this.unsubscribeUser = store.subscribe('user', () => this.render());
        document.addEventListener('click', this.onDocumentClick);
    }

    onUnmount() {
        this.unsubscribeUser?.();
        document.removeEventListener('click', this.onDocumentClick);
    }
}
