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
                <button type="button" class="ma-iconbtn" data-shell-action="close-settings"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <div class="ma-setting-row">
                    <div>
                        <div class="ma-setting-title" data-lang="settings.theme"></div>
                        <div class="ma-setting-hint" data-lang="settings.themeDesc"></div>
                    </div>
                    <button type="button" class="ma-btn ma-btn-secondary ma-btn-sm" data-shell-action="toggle-theme"
                        data-lang-aria="nav.toggleTheme"><i id="themeIcon" class="fa-solid fa-circle-half-stroke"></i></button>
                </div>
                <div>
                    <div class="ma-setting-title" style="margin-bottom:8px" data-lang="settings.language"></div>
                    <select id="languageSelect" class="ma-input">
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
            <div class="ma-dialog-head" style="align-items:flex-end;gap:20px">
                <img id="modalCover" src="" alt="" class="ma-dialog-cover">
                <div style="flex:1 1 auto;min-width:0">
                    <p class="ma-kicker" id="modalType"></p>
                    <h2 id="modalTitle" class="ma-dialog-title ma-truncate"></h2>
                </div>
                <button type="button" class="ma-iconbtn" data-shell-action="close-details"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-scroll" id="modalTracks"></div>
        </div>
    </div>

    <!-- Add to playlist -->
    <div id="addToPlaylistModal" class="modal hidden ma-overlay" style="z-index:80">
        <div class="ma-dialog" style="max-width:380px">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="track.addToPlaylist"></span>
                <button type="button" class="ma-iconbtn" data-shell-action="close-add-to-playlist"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <div id="playlistOptions" style="max-height:260px;overflow-y:auto"></div>
                <button type="button" class="ma-btn ma-btn-secondary" style="width:100%"
                    data-shell-action="close-add-to-playlist" data-lang="common.cancel"></button>
            </div>
        </div>
    </div>

    <!-- Create playlist -->
    <div id="createPlaylistModal" class="modal hidden ma-overlay" style="z-index:85"
        data-shell-action="close-create-playlist">
        <div class="ma-dialog" style="max-width:400px">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="playlist.create"></span>
                <button type="button" class="ma-iconbtn" data-shell-action="close-create-playlist"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <p class="ma-setting-hint" style="margin:0" data-lang="library.organize"></p>
                <input type="text" id="newPlaylistName" class="ma-input"
                    data-lang-placeholder="playlist.namePlaceholder">
                <div style="display:flex;gap:10px">
                    <button type="button" class="ma-btn ma-btn-primary" style="flex:1 1 0"
                        data-shell-action="confirm-create-playlist" data-lang="playlist.createButton"></button>
                    <button type="button" class="ma-btn ma-btn-secondary" style="flex:1 1 0"
                        data-shell-action="close-create-playlist" data-lang="common.cancel"></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirmation -->
    <div id="confirmModal" class="modal hidden ma-overlay" style="z-index:100">
        <div class="ma-dialog" style="max-width:380px" id="confirmModalContent">
            <div class="ma-dialog-body">
                <div id="confirmIcon" class="ma-notice-mark"></div>
                <h3 class="ma-dialog-title" id="confirmTitle"></h3>
                <p class="ma-setting-hint" style="margin:0" id="confirmMessage"></p>
                <div style="display:flex;gap:10px;margin-top:4px">
                    <button type="button" id="confirmYesBtn" class="ma-btn ma-btn-danger" style="flex:1 1 0"></button>
                    <button type="button" class="ma-btn ma-btn-secondary" style="flex:1 1 0"
                        data-shell-action="close-confirm" data-lang="common.cancel"></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Change cover -->
    <div id="changeCoverModal" class="modal hidden ma-overlay" style="z-index:110"
        data-shell-action="close-cover">
        <div class="ma-dialog" style="max-width:420px">
            <div class="ma-dialog-head">
                <span class="ma-kicker" data-lang="cover.title"></span>
                <button type="button" class="ma-iconbtn" data-shell-action="close-cover"
                    data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-dialog-body">
                <p class="ma-setting-hint" style="margin:0" data-lang="cover.subtitle"></p>
                <div style="display:flex;gap:8px">
                    <button type="button" id="coverTabUpload" class="ma-pill is-active" style="flex:1 1 0;justify-content:center"
                        data-shell-action="cover-tab-upload" data-lang="cover.upload"></button>
                    <button type="button" id="coverTabUrl" class="ma-pill" style="flex:1 1 0;justify-content:center"
                        data-shell-action="cover-tab-url" data-lang="cover.url"></button>
                </div>
                <div id="coverUploadSection">
                    <label class="ma-dropzone">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size:22px;color:var(--ink3)"></i>
                        <span class="ma-setting-hint" style="margin:0" data-lang="cover.dropHint"></span>
                        <span class="ma-kicker" style="text-transform:none;letter-spacing:normal;font-weight:400"
                            data-lang="cover.formats"></span>
                        <input type="file" id="coverFileInput" accept="image/*" hidden>
                    </label>
                </div>
                <div id="coverUrlSection" class="hidden">
                    <input type="text" id="coverUrlInput" class="ma-input" placeholder="https://example.com/image.jpg">
                </div>
                <div id="coverPreviewContainer" class="hidden" style="text-align:center">
                    <p class="ma-kicker" data-lang="cover.preview"></p>
                    <img id="coverPreviewImg" src="" alt=""
                        style="width:96px;height:96px;object-fit:cover;margin:8px auto 0;border:1px solid var(--border)">
                </div>
                <div style="display:flex;gap:10px">
                    <button type="button" class="ma-btn ma-btn-primary" style="flex:1 1 0"
                        data-shell-action="confirm-cover" data-lang="common.save"></button>
                    <button type="button" class="ma-btn ma-btn-secondary" style="flex:1 1 0"
                        data-shell-action="close-cover" data-lang="common.cancel"></button>
                </div>
            </div>
        </div>
    </div>

    <!-- Track record drawer -->
    <div id="trackDetailModal" class="modal hidden ma-scrim" style="z-index:60">
        <aside id="trackDetailContent" class="ma-drawer" role="dialog" aria-modal="true">
            <div class="ma-drawer-head">
                <span class="ma-kicker" data-lang="track.details"></span>
                <button type="button" class="ma-iconbtn" style="width:30px;height:30px"
                    data-shell-action="close-track-detail" data-lang-aria="common.close">✕</button>
            </div>
            <div class="ma-drawer-body">
                <div style="display:flex;gap:16px;align-items:flex-start">
                    <img id="trackDetailImage" src="" alt="" class="ma-drawer-cover" loading="lazy">
                    <div style="min-width:0;flex:1 1 auto">
                        <div id="trackDetailName" style="font-size:20px;font-weight:600;letter-spacing:-0.015em"></div>
                        <div id="trackDetailArtist" style="font-size:13px;color:var(--ink2);margin-top:4px"></div>
                        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                            <button type="button" id="trackDetailPlayBtn" class="ma-btn ma-btn-secondary ma-btn-sm">
                                <span data-lang="track.preview"></span>
                            </button>
                            <button type="button" id="trackDetailLikeBtn" class="ma-btn ma-btn-secondary ma-btn-sm">
                                <i id="trackDetailLikeIcon" class="fa-regular fa-heart"></i>
                                <span id="trackDetailLikeText"></span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="ma-rule" style="margin:24px 0 20px"></div>

                <div class="ma-kicker" data-lang="track.rate"></div>
                <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">
                    <div id="trackDetailRating" class="star-rating"></div>
                    <span id="trackDetailRatingText" style="font-size:13px;color:var(--ink2)"></span>
                </div>

                <div class="ma-drawer-section-head">
                    <span class="ma-kicker" data-lang="track.note"></span>
                    <button type="button" id="trackNoteSaveBtn" class="ma-btn ma-btn-ghost ma-btn-sm hidden"
                        data-lang="common.save"></button>
                </div>
                <textarea id="trackDetailNote" class="ma-textarea" style="margin-top:10px"
                    data-lang-placeholder="track.notePlaceholder"></textarea>

                <div class="ma-kicker" style="margin-top:24px" data-lang="track.addToPlaylist"></div>
                <button type="button" id="trackDetailAddBtn" class="ma-btn ma-btn-secondary"
                    style="width:100%;margin-top:12px;justify-content:flex-start">＋&nbsp;<span
                        data-lang="track.addToPlaylist"></span></button>

                <div class="ma-kicker" style="margin-top:24px" data-lang="track.listenOn"></div>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
                    <a id="trackSpotifyLink" href="#" target="_blank" rel="noopener" class="ma-linkrow">
                        <i class="fa-brands fa-spotify" style="color:#1DB954"></i><span>Spotify</span>
                        <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto;color:var(--ink3);font-size:11px"></i>
                    </a>
                    <a id="trackYoutubeLink" href="#" target="_blank" rel="noopener" class="ma-linkrow">
                        <i class="fa-brands fa-youtube" style="color:#FF0000"></i><span>YouTube</span>
                        <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto;color:var(--ink3);font-size:11px"></i>
                    </a>
                    <a id="trackAppleMusicLink" href="#" target="_blank" rel="noopener" class="ma-linkrow">
                        <i class="fa-brands fa-apple"></i><span>Apple Music</span>
                        <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left:auto;color:var(--ink3);font-size:11px"></i>
                    </a>
                </div>
            </div>
        </aside>
    </div>

    <!-- Mini player -->
    <div id="miniPlayer" class="mini-player">
        <div class="mini-player-progress" data-shell-action="seek">
            <div id="miniPlayerProgress" class="mini-player-progress-bar"></div>
        </div>
        <div class="mini-player-body">
            <img id="miniPlayerImage" src="" alt="" class="ma-cover ma-cover-md" style="padding:0">
            <div style="min-width:0;flex:0 1 220px">
                <p id="miniPlayerTitle" class="ma-truncate" style="margin:0;font-size:13px;font-weight:600"></p>
                <p id="miniPlayerArtist" class="ma-truncate" style="margin:2px 0 0;font-size:11px;color:var(--ink3)"></p>
            </div>
            <button type="button" id="miniPlayerPlayBtn" class="mini-player-play">
                <i id="miniPlayerIcon" class="fa-solid fa-play"></i>
            </button>
            <span id="miniPlayerTime" class="mini-player-time">0:00 / 0:30</span>
            <span class="ma-tag" style="margin-left:auto">30 sn</span>
            <button type="button" id="miniPlayerCloseBtn" class="ma-iconbtn" data-lang-aria="player.close">✕</button>
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
