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
    <!-- Settings Modal -->
    <div id="settingsModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/80 z-[70] flex items-center justify-center p-4">
        <div
            class="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl p-6 relative shadow-xl border border-gray-200 dark:border-white/5">
            <button data-shell-action="close-settings" data-lang-aria="common.close"
                class="absolute top-4 right-4 text-gray-400 hover:text-text-light dark:hover:text-white transition-colors">
                <i class="fa-solid fa-times text-xl"></i>
            </button>
            <h2 class="text-2xl font-bold mb-6" data-lang="settings.title"></h2>

            <div class="space-y-6">
                <!-- Theme -->
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-bold" data-lang="settings.theme"></h3>
                        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark"
                            data-lang="settings.themeDesc"></p>
                    </div>
                    <button data-shell-action="toggle-theme" data-lang-aria="nav.toggleTheme"
                        class="bg-gray-100 dark:bg-[#333] p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#444] transition-colors">
                        <i id="themeIcon" class="fa-solid fa-moon text-yellow-400 dark:text-yellow-400 text-xl"></i>
                    </button>
                </div>

                <!-- Language -->
                <div>
                    <h3 class="font-bold mb-2" data-lang="settings.language"></h3>
                    <select id="languageSelect" 
                        class="w-full bg-gray-100 dark:bg-[#333] border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-text-light dark:text-white focus:outline-none focus:border-green-500 transition-colors">
                        <option value="tr">🇹🇷 Türkçe</option>
                        <option value="en">🇬🇧 English</option>
                        <option value="ku">🟢 Kurdî (Kurmancî)</option>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <!-- Album/Playlist Details Modal -->
    <div id="detailsModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/80 flex justify-center items-center z-[60] p-4">
        <div
            class="bg-white dark:bg-card-dark rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-white/5 shadow-xl">
            <div
                class="p-6 bg-gray-50 dark:bg-gradient-to-b dark:from-gray-800 dark:to-transparent flex gap-6 items-end relative rounded-t-xl">
                <img id="modalCover" src="" class="w-32 h-32 shadow-lg rounded object-cover">
                <div class="flex-1">
                    <p class="text-sm uppercase tracking-wider text-text-secondary-light dark:text-gray-400"
                        id="modalType"></p>
                    <h2 id="modalTitle" class="text-3xl font-bold truncate"></h2>
                </div>
                <button data-shell-action="close-details" data-lang-aria="common.close"
                    class="text-gray-400 hover:text-text-light dark:hover:text-white transition-colors"><i
                        class="fa-solid fa-xmark fa-xl"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto p-4" id="modalTracks"></div>
        </div>
    </div>

    <!-- Add to Playlist Modal -->
    <div id="addToPlaylistModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 flex justify-center items-center z-[80]"
        >
        <div class="bg-white dark:bg-card-dark p-6 rounded-lg w-full max-w-sm border border-gray-200 dark:border-white/5 shadow-xl"
            >
            <h3 class="text-xl font-bold mb-4" data-lang="track.addToPlaylist"></h3>
            <div id="playlistOptions" class="space-y-2 max-h-60 overflow-y-auto mb-4"></div>
            <button
                data-shell-action="close-add-to-playlist"
                class="w-full py-2 bg-gray-100 dark:bg-[#2a2a34] rounded-lg text-text-secondary-light dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" data-lang="common.cancel"></button>
        </div>
    </div>

    <!-- Create Playlist Modal -->
    <div id="createPlaylistModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 z-[85] flex items-center justify-center p-4"
        data-shell-action="close-create-playlist">
        <div class="bg-white dark:bg-gradient-to-b dark:from-gray-800 dark:to-card-dark p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700"
            >
            <div class="text-center mb-6">
                <div
                    class="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-music text-2xl text-white"></i>
                </div>
                <h3 class="text-2xl font-bold" data-lang="playlist.create"></h3>
                <p class="text-text-secondary-light dark:text-gray-400 text-sm mt-1" data-lang="library.organize"></p>
            </div>
            <input type="text" id="newPlaylistName" data-lang-placeholder="playlist.namePlaceholder"
                class="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 rounded-xl mb-6 text-text-light dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                >
            <div class="flex gap-3">
                <button data-shell-action="confirm-create-playlist"
                    class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold py-3 rounded-full transition transform hover:scale-105">
                    <i class="fa-solid fa-plus mr-2"></i><span data-lang="playlist.createButton"></span>
                </button>
                <button data-shell-action="close-create-playlist"
                    class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-white py-3 rounded-full transition-colors" data-lang="common.cancel"></button>
            </div>
        </div>
    </div>

    <!-- Confirmation Modal -->
    <div id="confirmModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 z-[100] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gradient-to-b dark:from-gray-800 dark:to-card-dark p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 dark:border-gray-700 transform scale-95 opacity-0 transition-all duration-300"
            id="confirmModalContent">
            <div class="text-center mb-6">
                <div id="confirmIcon"
                    class="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-trash text-2xl text-white"></i>
                </div>
                <h3 class="text-xl font-bold" id="confirmTitle">Emin misiniz?</h3>
                <p class="text-text-secondary-light dark:text-gray-400 text-sm mt-2" id="confirmMessage">Bu işlemi geri
                    alamazsınız.</p>
            </div>
            <div class="flex gap-3">
                <button id="confirmYesBtn"
                    class="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold py-3 rounded-full transition transform hover:scale-105">
                    <i class="fa-solid fa-check mr-2"></i><span data-lang="playlist.deleteConfirm"></span>
                </button>
                <button data-shell-action="close-confirm"
                    class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-white py-3 rounded-full transition-colors" data-lang="common.cancel"></button>
            </div>
        </div>
    </div>

    <!-- Change Cover Modal -->
    <div id="changeCoverModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 z-[110] flex items-center justify-center p-4"
        data-shell-action="close-cover">
        <div class="bg-white dark:bg-gradient-to-b dark:from-gray-800 dark:to-card-dark p-6 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-in"
            >
            <div class="text-center mb-4">
                <div
                    class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-image text-2xl text-white"></i>
                </div>
                <h3 class="text-xl font-bold" data-lang="cover.title"></h3>
                <p class="text-text-secondary-light dark:text-gray-400 text-sm mt-1" data-lang="cover.subtitle"></p>
            </div>

            <!-- Tab Selection -->
            <div class="flex gap-2 mb-4">
                <button data-shell-action="cover-tab-upload" id="coverTabUpload"
                    class="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-blue-500 text-white transition-colors">
                    <i class="fa-solid fa-upload mr-2"></i><span data-lang="cover.upload"></span>
                </button>
                <button data-shell-action="cover-tab-url" id="coverTabUrl"
                    class="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-text-secondary-light dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <i class="fa-solid fa-link mr-2"></i><span data-lang="cover.url"></span>
                </button>
            </div>

            <!-- Upload Section -->
            <div id="coverUploadSection" class="mb-4">
                <label
                    class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div class="flex flex-col items-center justify-center pt-5 pb-6">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2"></i>
                        <p class="text-sm text-text-secondary-light dark:text-gray-400" data-lang="cover.dropHint"></p>
                        <p class="text-xs text-gray-500" data-lang="cover.formats"></p>
                    </div>
                    <input type="file" id="coverFileInput" accept="image/*" class="hidden"
                        >
                </label>
            </div>

            <!-- URL Section -->
            <div id="coverUrlSection" class="mb-4 hidden">
                <input type="text" id="coverUrlInput" placeholder="https://example.com/image.jpg"
                    class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-lg text-text-light dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors">
            </div>

            <!-- Preview -->
            <div id="coverPreviewContainer" class="mb-4 hidden">
                <p class="text-sm text-text-secondary-light dark:text-gray-400 mb-2" data-lang="cover.preview"></p>
                <img id="coverPreviewImg" src=""
                    class="w-24 h-24 object-cover rounded-lg mx-auto border-2 border-gray-200 dark:border-gray-600">
            </div>

            <div class="flex gap-3">
                <button data-shell-action="confirm-cover"
                    class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-3 rounded-full transition transform hover:scale-105">
                    <i class="fa-solid fa-check mr-2"></i><span data-lang="common.save"></span>
                </button>
                <button data-shell-action="close-cover"
                    class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-white py-3 rounded-full transition-colors" data-lang="common.cancel"></button>
            </div>
        </div>
    </div>

    <!-- Track Detail Modal -->
    <div id="trackDetailModal"
        class="fixed inset-0 bg-black/50 dark:bg-black/90 z-[9999] hidden flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div id="trackDetailContent"
            class="bg-white dark:bg-gradient-to-b dark:from-gray-800 dark:to-card-dark w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 translate-y-full sm:translate-y-0 opacity-0 scale-95 border-t border-gray-200 dark:border-white/10 sm:border">
            <!-- Header with close -->
            <div
                class="sticky top-0 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 flex justify-between items-center border-b border-gray-200 dark:border-white/10">
                <h3 class="font-bold text-lg" data-lang="track.details"></h3>
                <button data-shell-action="close-track-detail" data-lang-aria="common.close"
                    class="text-gray-400 hover:text-text-light dark:hover:text-white p-2 transition-colors">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>

            <!-- Track Info -->
            <div class="p-6">
                <div class="flex items-center gap-4 mb-6">
                    <img id="trackDetailImage" src="" class="w-20 h-20 rounded-lg object-cover shadow-lg" loading="lazy">
                    <div class="flex-1 min-w-0">
                        <h4 id="trackDetailName" class="font-bold text-xl truncate"></h4>
                        <p id="trackDetailArtist" class="text-text-secondary-light dark:text-gray-400 truncate"></p>
                    </div>
                </div>

                <!-- Star Rating -->
                <div class="bg-gray-100 dark:bg-white/5 rounded-xl p-4 mb-4">
                    <p class="text-sm text-text-secondary-light dark:text-gray-400 mb-2" data-lang="track.rate"></p>
                    <div id="trackDetailRating" class="flex justify-center gap-2"></div>
                    <p id="trackDetailRatingText" class="text-center text-sm text-gray-500 mt-2"></p>
                </div>

                <!-- Preview Button -->
                <button id="trackDetailPlayBtn" 
                    class="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl mb-4 flex items-center justify-center gap-3 hover:opacity-90 transition">
                    <i class="fa-solid fa-play"></i>
                    <span data-lang="track.preview"></span>
                </button>

                <!-- Streaming Links -->
                <p class="text-sm text-text-secondary-light dark:text-gray-400 mb-3" data-lang="track.listenOn"></p>
                <div class="grid grid-cols-1 gap-3 mb-4">
                    <!-- Spotify -->
                    <a id="trackSpotifyLink" href="#" target="_blank"
                        class="flex items-center gap-4 bg-[#1DB954]/10 dark:bg-[#1DB954]/20 hover:bg-[#1DB954]/20 dark:hover:bg-[#1DB954]/30 p-4 rounded-xl transition-colors">
                        <i class="fa-brands fa-spotify text-2xl text-[#1DB954]"></i>
                        <span class="font-bold">Spotify</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-gray-400 ml-auto"></i>
                    </a>
                    <!-- YouTube -->
                    <a id="trackYoutubeLink" href="#" target="_blank"
                        class="flex items-center gap-4 bg-[#FF0000]/10 dark:bg-[#FF0000]/20 hover:bg-[#FF0000]/20 dark:hover:bg-[#FF0000]/30 p-4 rounded-xl transition-colors">
                        <i class="fa-brands fa-youtube text-2xl text-[#FF0000]"></i>
                        <span class="font-bold">YouTube</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-gray-400 ml-auto"></i>
                    </a>
                    <!-- Apple Music -->
                    <a id="trackAppleMusicLink" href="#" target="_blank"
                        class="flex items-center gap-4 bg-[#FA2D48]/10 dark:bg-[#FA2D48]/20 hover:bg-[#FA2D48]/20 dark:hover:bg-[#FA2D48]/30 p-4 rounded-xl transition-colors">
                        <i class="fa-brands fa-apple text-2xl text-text-light dark:text-white"></i>
                        <span class="font-bold">Apple Music</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-gray-400 ml-auto"></i>
                    </a>
                </div>

                <!-- Personal Note -->
                <div class="bg-gray-100 dark:bg-white/5 rounded-xl p-4 mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-sm text-text-secondary-light dark:text-gray-400">
                            <i class="fa-solid fa-pen-to-square mr-1"></i>
                            <span data-lang="track.note"></span>
                        </p>
                        <button id="trackNoteSaveBtn" 
                            class="text-xs text-green-500 hover:text-green-400 hidden">
                            <i class="fa-solid fa-check mr-1"></i><span data-lang="common.save"></span>
                        </button>
                    </div>
                    <textarea id="trackDetailNote"
                        data-lang-placeholder="track.notePlaceholder"
                        class="w-full bg-white dark:bg-transparent border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-text-light dark:text-white text-sm resize-none focus:outline-none focus:border-green-500 transition-colors"
                        rows="2" ></textarea>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                    <button id="trackDetailLikeBtn" 
                        class="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i id="trackDetailLikeIcon" class="fa-regular fa-heart"></i>
                        <span id="trackDetailLikeText"></span>
                    </button>
                    <button id="trackDetailAddBtn" 
                        class="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i class="fa-solid fa-plus"></i>
                        <span data-lang="track.addToPlaylist"></span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Mini Player -->
    <div id="miniPlayer"
        class="mini-player bg-white dark:bg-gradient-to-r dark:from-[#282828] dark:to-[#181818] border-t border-gray-200 dark:border-[#333]">
        <div class="mini-player-progress" data-shell-action="seek">
            <div id="miniPlayerProgress" class="mini-player-progress-bar"></div>
        </div>
        <div class="flex items-center gap-4 max-w-6xl mx-auto">
            <img id="miniPlayerImage" src="" class="w-14 h-14 rounded object-cover shadow-lg">
            <div class="flex-1 min-w-0">
                <p id="miniPlayerTitle" class="font-bold truncate"></p>
                <p id="miniPlayerArtist" class="text-sm text-text-secondary-light dark:text-gray-400 truncate"></p>
            </div>
            <div class="flex items-center gap-4">
                <span id="miniPlayerTime"
                    class="text-xs text-text-secondary-light dark:text-gray-400 w-24 text-center">0:00 / 0:30</span>
                <button id="miniPlayerPlayBtn"
                    class="w-12 h-12 bg-green-500 dark:bg-white rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg">
                    <i id="miniPlayerIcon" class="fa-solid fa-play text-white dark:text-black text-xl"></i>
                </button>
                <button id="miniPlayerCloseBtn" data-lang-aria="player.close"
                    class="text-gray-400 hover:text-text-light dark:hover:text-white p-2 transition-colors">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
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
        'close-track-detail': () => closeModal('trackDetailModal', 'trackDetailContent'),
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

    // The track sheet is not a `.modal`, so the generic backdrop handler in
    // Modal.js never sees it. Close it when the dimmed area itself is clicked.
    byId('trackDetailModal')?.addEventListener('click', event => {
        if (event.target.id === 'trackDetailModal') closeModal('trackDetailModal', 'trackDetailContent');
    });
}
