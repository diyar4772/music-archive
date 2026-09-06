/**
 * Application shell: the modal and mini-player markup that lives outside the
 * router's view container.
 *
 * The markup carries no inline event attributes. Every control is either wired
 * by id or dispatched from one delegated `data-shell-action` listener, so the
 * page can run under a Content-Security-Policy without `unsafe-inline`.
 */
import {
    initDetails, playTrackFromDetail, toggleLikeFromDetail, saveTrackNote,
    showNoteSaveBtn, addToPlaylistFromDetail, setCoverTab, handleCoverFileSelect,
    confirmCoverChange
} from './Details.js';
import { closeModal, closeConfirmModal } from './Modal.js';
import { seekTo } from './MiniPlayer.js';
import { applyTranslations } from '../services/i18n.js';

function mountShellMarkup() {
    document.body.insertAdjacentHTML('beforeend', `
    <!-- Settings -->
    <div id="settingsModal" class="modal hidden ma-overlay">
        <div class="ma-dialog">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="settings.title"></span>
                <button type="button" class="ma-iconbtn" data-testid="settings-close" data-shell-action="close-settings"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <div class="ma-setting-row">
                    <div>
                        <div class="ma-setting-title" data-lang="settings.theme"></div>
                        <div class="ma-setting-hint" data-lang="settings.themeDesc"></div>
                    </div>
                    <button type="button" class="ma-btn ma-btn-secondary ma-btn-sm" data-testid="settings-theme" data-shell-action="toggle-theme"
                        data-lang-aria="nav.toggleTheme"><i id="themeIcon" class="fa-solid fa-circle-half-stroke"></i></button>
                </div>
                <div>
                    <div class="ma-shell-1 ma-setting-title" data-lang="settings.language"></div>
                    <select id="languageSelect" class="ma-input" data-testid="settings-language">
                        <option value="tr">Türkçe</option>
                        <option value="en">English</option>
                        <option value="ku">Kurdî (Kurmancî)</option>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <!-- Album / playlist details -->
    <div id="detailsModal" class="modal hidden ma-overlay">
        <div class="ma-dialog ma-dialog-wide">
            <div class="ma-shell-2 ma-dialog-head">
                <img id="modalCover" src="/js/placeholder.svg" alt="" class="ma-dialog-cover">
                <div class="ma-shell-3">
                    <p class="ma-kicker" id="modalType"></p>
                    <h2 id="modalTitle" class="ma-dialog-title ma-truncate"></h2>
                </div>
                <button type="button" class="ma-iconbtn" data-testid="details-close" data-shell-action="close-details"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-scroll" id="modalTracks"></div>
        </div>
    </div>

    <!-- Add to playlist -->
    <div id="addToPlaylistModal" class="ma-shell-4 modal hidden ma-overlay">
        <div class="ma-shell-5 ma-dialog">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="track.addToPlaylist"></span>
                <button type="button" class="ma-iconbtn" data-testid="add-to-playlist-close" data-shell-action="close-add-to-playlist"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <div id="playlistOptions" class="ma-shell-6"></div>
                <button type="button" class="ma-shell-7 ma-btn ma-btn-secondary" data-testid="add-to-playlist-cancel"
                    data-shell-action="close-add-to-playlist" data-lang="common.cancel"></button>
            </div>
        </div>
    </div>

    <!-- Create playlist -->
    <div id="createPlaylistModal" class="ma-shell-8 modal hidden ma-overlay"
        data-shell-action="close-create-playlist">
        <div class="ma-shell-9 ma-dialog">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="playlist.create"></span>
                <button type="button" class="ma-iconbtn" data-testid="create-playlist-close" data-shell-action="close-create-playlist"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <p class="ma-shell-10 ma-setting-hint" data-lang="library.organize"></p>
                <input type="text" id="newPlaylistName" class="ma-input" data-testid="create-playlist-name"
                    data-lang-placeholder="playlist.namePlaceholder">
                <div class="ma-shell-11">
                    <button type="button" class="ma-shell-12 ma-btn ma-btn-primary" data-testid="create-playlist-confirm"
                        data-shell-action="confirm-create-playlist" data-lang="playlist.createButton"></button>
                    <button type="button" class="ma-shell-13 ma-btn ma-btn-secondary" data-testid="create-playlist-cancel"
                        data-shell-action="close-create-playlist" data-lang="common.cancel"></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirmation -->
    <div id="confirmModal" class="ma-shell-14 modal hidden ma-overlay">
        <div class="ma-shell-15 ma-dialog" id="confirmModalContent">
            <div class="ma-dialog-body">
                <div id="confirmIcon" class="ma-notice-mark"></div>
                <h3 class="ma-dialog-title" id="confirmTitle"></h3>
                <p class="ma-shell-16 ma-setting-hint" id="confirmMessage"></p>
                <div class="ma-shell-17">
                    <button type="button" id="confirmYesBtn" class="ma-shell-18 ma-btn ma-btn-danger" data-testid="confirm-yes"></button>
                    <button type="button" class="ma-shell-19 ma-btn ma-btn-secondary" data-testid="confirm-cancel"
                        data-shell-action="close-confirm" data-lang="common.cancel"></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Change cover -->
    <div id="changeCoverModal" class="ma-shell-20 modal hidden ma-overlay"
        data-shell-action="close-cover">
        <div class="ma-shell-21 ma-dialog">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="cover.title"></span>
                <button type="button" class="ma-iconbtn" data-testid="cover-close" data-shell-action="close-cover"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <p class="ma-shell-22 ma-setting-hint" data-lang="cover.subtitle"></p>
                <div class="ma-shell-23">
                    <button type="button" id="coverTabUpload" class="ma-shell-24 ma-pill is-active" data-testid="cover-tab-upload"
                        data-shell-action="cover-tab-upload" data-lang="cover.upload"></button>
                    <button type="button" id="coverTabUrl" class="ma-shell-25 ma-pill" data-testid="cover-tab-url"
                        data-shell-action="cover-tab-url" data-lang="cover.url"></button>
                </div>
                <div id="coverUploadSection">
                    <label class="ma-dropzone">
                        <i class="ma-shell-26 fa-solid fa-cloud-arrow-up"></i>
                        <span class="ma-shell-27 ma-setting-hint" data-lang="cover.dropHint"></span>
                        <span class="ma-shell-28 ma-kicker"
                            data-lang="cover.formats"></span>
                        <input type="file" id="coverFileInput" accept="image/*" data-testid="cover-file" hidden>
                    </label>
                </div>
                <div id="coverUrlSection" class="hidden">
                    <input type="text" id="coverUrlInput" class="ma-input" data-testid="cover-url" placeholder="https://example.com/image.jpg">
                </div>
                <div id="coverPreviewContainer" class="ma-shell-29 hidden">
                    <p class="ma-kicker" data-lang="cover.preview"></p>
                    <img id="coverPreviewImg" src="/js/placeholder.svg" alt=""
                        class="ma-shell-30">
                </div>
                <div class="ma-shell-31">
                    <button type="button" class="ma-shell-32 ma-btn ma-btn-primary" data-testid="cover-save"
                        data-shell-action="confirm-cover" data-lang="common.save"></button>
                    <button type="button" class="ma-shell-33 ma-btn ma-btn-secondary" data-testid="cover-cancel"
                        data-shell-action="close-cover" data-lang="common.cancel"></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Track record drawer -->
    <div id="trackDetailModal" class="ma-shell-34 modal hidden ma-scrim">
        <aside id="trackDetailContent" class="ma-drawer" role="dialog" aria-modal="true">
            <div class="ma-drawer-head">
                <span class="ma-kicker" data-lang="track.details"></span>
                <button type="button" class="ma-shell-35 ma-iconbtn" data-testid="track-detail-close"
                    data-shell-action="close-track-detail" data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-drawer-body">
                <div class="ma-shell-36">
                    <img id="trackDetailImage" src="/js/placeholder.svg" alt="" class="ma-drawer-cover" loading="lazy">
                    <div class="ma-shell-37">
                        <div id="trackDetailName" class="ma-shell-38"></div>
                        <div id="trackDetailArtist" class="ma-shell-39"></div>
                        <div class="ma-shell-40">
                            <button type="button" id="trackDetailPlayBtn" class="ma-btn ma-btn-secondary ma-btn-sm" data-testid="track-play">
                                <span data-lang="track.preview"></span>
                            </button>
                            <button type="button" id="trackDetailLikeBtn" class="ma-btn ma-btn-secondary ma-btn-sm" data-testid="track-like">
                                <i id="trackDetailLikeIcon" class="fa-regular fa-heart"></i>
                                <span id="trackDetailLikeText"></span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="ma-shell-41 ma-rule"></div>

                <div class="ma-kicker" data-lang="track.rate"></div>
                <div class="ma-shell-42">
                    <div id="trackDetailRating" class="star-rating"></div>
                    <span id="trackDetailRatingText" class="ma-shell-43"></span>
                </div>

                <!-- Müzik Defteri: a composer on top, the history underneath.
                     Saving adds an entry; it never overwrites the last one. -->
                <div class="ma-drawer-section-head">
                    <span class="ma-kicker" data-lang="journal.title"></span>
                    <span id="trackJournalCount" class="ma-journal-count"></span>
                </div>
                <textarea id="trackDetailNote" class="ma-shell-44 ma-textarea" data-testid="track-note"
                    data-lang-placeholder="journal.placeholder"></textarea>
                <div class="ma-journal-compose">
                    <span class="ma-journal-hint" data-lang="journal.hint"></span>
                    <button type="button" id="trackNoteSaveBtn" class="ma-btn ma-btn-primary ma-btn-sm hidden" data-testid="track-note-save"
                        data-lang="journal.save"></button>
                </div>
                <div id="trackJournalList" class="ma-journal"></div>

                <div class="ma-shell-45 ma-kicker" data-lang="track.addToPlaylist"></div>
                <button type="button" id="trackDetailAddBtn" class="ma-shell-46 ma-btn ma-btn-secondary" data-testid="track-add-to-playlist"
                   >＋&nbsp;<span
                        data-lang="track.addToPlaylist"></span></button>

                <div class="ma-shell-47 ma-kicker" data-lang="track.listenOn"></div>
                <div class="ma-shell-48">
                    <a id="trackSpotifyLink" href="#" target="_blank" rel="noopener" class="ma-linkrow">
                        <i class="ma-shell-49 fa-brands fa-spotify"></i><span>Spotify</span>
                        <i class="ma-shell-50 fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                    <a id="trackYoutubeLink" href="#" target="_blank" rel="noopener" class="ma-linkrow">
                        <i class="ma-shell-51 fa-brands fa-youtube"></i><span>YouTube</span>
                        <i class="ma-shell-52 fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                    <a id="trackAppleMusicLink" href="#" target="_blank" rel="noopener" class="ma-linkrow">
                        <i class="fa-brands fa-apple"></i><span>Apple Music</span>
                        <i class="ma-shell-53 fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                </div>
            </div>
        </aside>
    </div>

    <!-- Mini player -->
    <div id="miniPlayer" class="mini-player">
        <div class="mini-player-progress" data-testid="player-progress" data-shell-action="seek">
            <div id="miniPlayerProgress" class="mini-player-progress-bar"></div>
        </div>
        <div class="mini-player-body">
            <img id="miniPlayerImage" src="/js/placeholder.svg" alt="" class="ma-shell-54 ma-cover ma-cover-md">
            <div class="ma-shell-55">
                <p id="miniPlayerTitle" class="ma-shell-56 ma-truncate"></p>
                <p id="miniPlayerArtist" class="ma-shell-57 ma-truncate"></p>
            </div>
            <button type="button" id="miniPlayerPlayBtn" class="mini-player-play" data-testid="player-toggle">
                <i id="miniPlayerIcon" class="fa-solid fa-play"></i>
            </button>
            <span id="miniPlayerTime" class="mini-player-time">0:00 / 0:30</span>
            <span class="ma-shell-58 ma-tag">30 sn</span>
            <button type="button" id="miniPlayerCloseBtn" class="ma-iconbtn" data-testid="player-close" data-lang-aria="player.close">✕</button>
        </div>
    </div>
`);
}

/**
 * Inject the shell markup and wire every control.
 * @param {Object} handlers
 * @param {() => void} handlers.onToggleTheme
 * @param {(language: string) => void} handlers.onChangeLanguage
 * @param {() => void} handlers.onConfirmCreatePlaylist
 * @param {() => string} handlers.getLanguage
 */
export function mountShell(handlers = {}) {
    mountShellMarkup();
    applyTranslations(document.body);
    initDetails();

    const byId = id => document.getElementById(id);
    const on = (id, event, listener) => byId(id)?.addEventListener(event, listener);

    const actions = {
        'close-settings': () => closeModal('settingsModal'),
        'close-details': () => closeModal('detailsModal'),
        'close-add-to-playlist': () => closeModal('addToPlaylistModal'),
        'close-create-playlist': () => closeModal('createPlaylistModal'),
        'close-confirm': () => closeConfirmModal(),
        'close-cover': () => closeModal('changeCoverModal'),
        'close-track-detail': () => closeModal('trackDetailModal'),
        'confirm-create-playlist': () => handlers.onConfirmCreatePlaylist?.(),
        'confirm-cover': () => void confirmCoverChange(),
        'cover-tab-upload': () => setCoverTab('upload'),
        'cover-tab-url': () => setCoverTab('url'),
        'toggle-theme': () => handlers.onToggleTheme?.()
    };

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-shell-action]');
        if (!trigger) return;
        const action = trigger.dataset.shellAction;
        if (action === 'seek') {
            seekTo(event, trigger);
            return;
        }
        actions[action]?.();
    });

    on('languageSelect', 'change', event => handlers.onChangeLanguage?.(event.target.value));
    on('newPlaylistName', 'keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handlers.onConfirmCreatePlaylist?.();
        }
    });

    on('trackDetailPlayBtn', 'click', () => void playTrackFromDetail());
    on('trackDetailLikeBtn', 'click', () => void toggleLikeFromDetail());
    on('trackDetailAddBtn', 'click', () => void addToPlaylistFromDetail());
    on('trackNoteSaveBtn', 'click', () => void saveTrackNote());
    on('trackDetailNote', 'input', showNoteSaveBtn);
    on('coverFileInput', 'change', handleCoverFileSelect);

    // The drawer is a `.modal` now, so Modal.js's backdrop and Escape handlers
    // already close it; nothing extra to wire.
}
