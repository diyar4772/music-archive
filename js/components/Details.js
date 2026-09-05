/**
 * Detail modals: album, track and playlist.
 *
 * Everything here builds DOM nodes instead of writing markup strings — album,
 * track and playlist names come from Spotify or from the user, and this is the
 * one place that renders all three.
 */
import { performSearch } from '../services/search.js';
import { get, post, put } from '../services/api.js';
import { store } from '../state/store.js';
import {
    getPlaylists, likeTrack, unlikeTrack, isTrackLiked,
    addToPlaylist, removeFromPlaylist, deletePlaylist,
    toggleAlbumFollow, isAlbumFollowed
} from '../services/library.js';
import { rateTrack, removeRating, getTrackRating } from '../services/rating.js';
import { playTrack, isPlaying } from './MiniPlayer.js';
import { openModal, closeModal, showConfirmModal } from './Modal.js';
import { showToast, formatTime } from '../utils.js';
import { el, cover, replace, emptyState, errorState, loadingState, PLACEHOLDER_IMAGE } from '../core/dom.js';
import { t } from '../services/i18n.js';

let currentTrack = null;
let currentPlaylist = null;
let coverData = null;

const byId = id => document.getElementById(id);
const reportError = error => showToast(`❌ ${error.message || t('common.error')}`, 'error');

const PRIMARY_BUTTON = 'ma-btn ma-btn-primary ma-btn-sm';
const GHOST_BUTTON = 'ma-btn ma-btn-secondary ma-btn-sm';
const DANGER_BUTTON = 'ma-btn ma-btn-danger ma-btn-sm';

/**
 * @param {string} label
 * @param {() => void} onClick
 * @param {string} [className]
 * @returns {HTMLButtonElement}
 */
function button(label, onClick, className = PRIMARY_BUTTON) {
    return el('button', { className, text: label, attrs: { type: 'button' }, on: { click: onClick } });
}

/**
 * Half-star rating control for a track or an album.
 * @param {HTMLElement} container
 * @param {{id: string, name?: string, artist?: string, image?: string, itemType?: 'track'|'album'}} item
 * @param {HTMLElement} [readout] - optional element that echoes the current score
 */
function renderRatingControl(container, item, readout) {
    if (!container) return;
    const itemType = item.itemType || 'track';

    const paint = () => {
        const current = getTrackRating(item.id, itemType) || 0;
        const stars = [];

        for (let position = 1; position <= 5; position += 1) {
            const full = current >= position;
            const half = !full && current >= position - 0.5;
            const star = el('button', {
                className: `star ma-starbtn${full || half ? ' is-on' : ''}`,
                attrs: { type: 'button', 'aria-label': t('track.stars', { n: position }) },
                text: full ? '★' : (half ? '⯨' : '☆')
            });
            // Left half of the star sets x.5, right half sets x.0 — that is the
            // whole reason ratings are stored in 0.5 steps.
            star.addEventListener('click', event => {
                const rect = star.getBoundingClientRect();
                const score = event.clientX - rect.left < rect.width / 2 ? position - 0.5 : position;
                void applyScore(score === current ? 0 : score);
            });
            stars.push(star);
        }

        const clear = el('button', {
            className: 'ma-btn ma-btn-ghost ma-btn-sm',
            style: 'margin-left:6px',
            attrs: { type: 'button' },
            text: t('track.resetRating')
        });
        clear.addEventListener('click', () => void applyScore(0));
        clear.hidden = current === 0;

        replace(container, ...stars, clear);
        if (readout) readout.textContent = current ? `${current} / 5` : t('track.ratingEmpty');
    };

    const applyScore = async score => {
        if (!store.token) {
            window.openAuthModal?.();
            return;
        }
        const ok = score
            ? await rateTrack(item.id, score, {
                itemType,
                itemName: item.name,
                artistName: item.artist,
                image: item.image
            })
            : await removeRating(item.id, itemType);
        if (ok) paint();
    };

    paint();
}

/**
 * Resolve a playable preview URL, falling back to a track search when the row
 * we were handed has none (album rows and stored likes often do not).
 * @param {{id: string, name: string, artist?: string, preview_url?: string}} track
 * @returns {Promise<string|null>}
 */
async function resolvePreview(track) {
    if (track.preview_url) return track.preview_url;
    try {
        const results = await performSearch(`${track.name} ${track.artist || ''}`.trim(), 'track');
        const list = Array.isArray(results) ? results : [];
        const match = list.find(item => item.id === track.id) || list[0];
        return match?.preview_url || null;
    } catch {
        return null;
    }
}

/**
 * @param {{id: string, name: string, artist?: string, image?: string, preview_url?: string, duration_ms?: number}} track
 * @param {() => Promise<void>|void} [onRemove]
 * @returns {HTMLElement}
 */
function trackRow(track, onRemove) {
    const play = el('button', {
        className: 'mini-player-play',
        style: 'width:32px;height:32px;font-size:12px',
        attrs: { type: 'button', 'aria-label': t('player.playAria', { name: track.name }) },
        html: '<i class="fa-solid fa-play"></i>'
    });

    play.addEventListener('click', async event => {
        event.stopPropagation();
        play.disabled = true;
        play.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        const previewUrl = await resolvePreview(track);
        play.disabled = false;
        play.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (!previewUrl) {
            showToast(`❌ ${t('track.noPreview')}`, 'error');
            return;
        }
        track.preview_url = previewUrl;
        playTrack({ ...track, preview_url: previewUrl });
        play.innerHTML = isPlaying(track.id) ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    });

    const title = el('button', {
        className: 'ma-row-main',
        style: 'border:0;background:transparent;color:inherit;font:inherit;padding:0',
        attrs: { type: 'button' },
        on: { click: () => openTrackDetail(track.id, track.name, track.artist, track.image, track.preview_url) }
    }, [
        el('span', { className: 'ma-row-title', text: track.name }),
        track.artist && el('span', { className: 'ma-row-sub', text: track.artist })
    ]);

    return el('div', { className: 'ma-row', dataset: { trackId: track.id } }, [
        cover(track.image, track.name || '', 'ma-cover-sm'),
        title,
        track.duration_ms ? el('span', { className: 'ma-col-dur', text: formatTime(track.duration_ms) }) : null,
        play,
        onRemove ? el('button', {
            className: 'ma-iconbtn',
            text: '✕',
            attrs: { type: 'button', 'aria-label': t('playlist.removeAria', { name: track.name }) },
            on: { click: event => { event.stopPropagation(); void onRemove(); } }
        }) : null
    ]);
}

// ---------------------------------------------------------------- album ----

/**
 * Open the album modal for a Spotify album id.
 * @param {string} id
 */
export async function openAlbumDetail(id) {
    const body = byId('modalTracks');
    byId('modalTitle').textContent = t('common.loading');
    byId('modalType').textContent = t('album.title');
    byId('modalCover').src = PLACEHOLDER_IMAGE;
    replace(body, loadingState(5));
    openModal('detailsModal');

    try {
        const album = await get(`/album/${encodeURIComponent(id)}`);

        byId('modalTitle').textContent = album.name;
        byId('modalType').textContent = [album.artist, album.releaseDate?.slice(0, 4)].filter(Boolean).join(' · ');
        byId('modalCover').src = album.image || PLACEHOLDER_IMAGE;

        const saveButton = button('', () => {}, GHOST_BUTTON);
        const paintSave = () => {
            const saved = isAlbumFollowed(album.id);
            saveButton.textContent = saved ? `✓ ${t('album.saved')}` : `+ ${t('album.save')}`;
            saveButton.className = saved ? PRIMARY_BUTTON : GHOST_BUTTON;
        };
        saveButton.addEventListener('click', async () => {
            if (!store.token) return window.openAuthModal?.();
            await toggleAlbumFollow(album);
            paintSave();
        });
        paintSave();

        const ratingRow = el('div', { className: 'star-rating' });
        const ratingText = el('p', { style: 'font-size:12px;color:var(--ink3);margin:6px 0 0' });
        renderRatingControl(ratingRow, { ...album, itemType: 'album' }, ratingText);

        replace(body,
            el('div', {
                style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;'
                    + 'padding:16px 0;border-bottom:1px solid var(--border)'
            }, [
                el('div', {}, [
                    el('p', { className: 'ma-kicker', style: 'margin:0 0 8px', text: t('album.rate') }),
                    ratingRow,
                    ratingText
                ]),
                saveButton
            ]),
            el('div', { className: 'ma-rows', style: 'border-top:0' },
                (album.tracks || []).map(track => trackRow({ ...track, artist: track.artist || album.artist, image: album.image })))
        );
    } catch (error) {
        replace(body, errorState(t('album.loadFailed'), error.message || ''));
    }
}

// ---------------------------------------------------------------- track ----

/**
 * Open the track detail sheet.
 * @param {string} id
 * @param {string} [name]
 * @param {string} [artist]
 * @param {string} [image]
 * @param {string} [preview]
 */
export function openTrackDetail(id, name, artist, image, preview) {
    const stored = store.likedTracks.find(t => t.trackId === id);
    currentTrack = {
        id,
        name: name || stored?.trackName || '',
        artist: artist || stored?.artistName || '',
        image: image || stored?.image,
        preview_url: preview || stored?.previewUrl
    };

    byId('trackDetailName').textContent = currentTrack.name;
    byId('trackDetailArtist').textContent = currentTrack.artist;
    byId('trackDetailImage').src = currentTrack.image || PLACEHOLDER_IMAGE;
    byId('trackDetailNote').value = stored?.userNote || '';
    byId('trackNoteSaveBtn').classList.add('hidden');

    paintLikeButton();

    const query = encodeURIComponent(`${currentTrack.name} ${currentTrack.artist}`.trim());
    byId('trackSpotifyLink').href = `https://open.spotify.com/track/${encodeURIComponent(id)}`;
    byId('trackYoutubeLink').href = `https://www.youtube.com/results?search_query=${query}`;
    byId('trackAppleMusicLink').href = `https://music.apple.com/search?term=${query}`;

    renderRatingControl(byId('trackDetailRating'), currentTrack, byId('trackDetailRatingText'));
    openModal('trackDetailModal');
}

function paintLikeButton() {
    const liked = isTrackLiked(currentTrack.id);
    byId('trackDetailLikeText').textContent = liked ? t('track.unlike') : t('track.like');
    const icon = byId('trackDetailLikeIcon');
    icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    icon.style.color = liked ? 'var(--pink-ink)' : '';
}

/**
 * Play the open track, resolving a preview URL first when needed.
 */
export async function playTrackFromDetail() {
    const playButton = byId('trackDetailPlayBtn');
    playButton.disabled = true;
    try {
        const previewUrl = await resolvePreview(currentTrack);
        if (!previewUrl) {
            showToast(`❌ ${t('track.noPreview')}`, 'error');
            return;
        }
        currentTrack.preview_url = previewUrl;
        playTrack(currentTrack);
    } finally {
        playButton.disabled = false;
    }
}

/**
 * Like or unlike the open track.
 */
export async function toggleLikeFromDetail() {
    if (!store.token) return window.openAuthModal?.();
    const track = currentTrack;
    const ok = isTrackLiked(track.id) ? await unlikeTrack(track.id) : await likeTrack(track);
    if (ok) paintLikeButton();
}

/**
 * Persist the personal note on the open track.
 */
export async function saveTrackNote() {
    const field = byId('trackDetailNote');
    try {
        await post('/library/note', { spotifyId: currentTrack.id, note: field.value });
        const stored = store.likedTracks.find(t => t.trackId === currentTrack.id);
        if (stored) stored.userNote = field.value;
        byId('trackNoteSaveBtn').classList.add('hidden');
        showToast(`📝 ${t('track.noteSaved')}`, 'success');
    } catch (error) {
        reportError(error);
    }
}

/** Reveal the note save button once the textarea changes. */
export function showNoteSaveBtn() {
    byId('trackNoteSaveBtn').classList.remove('hidden');
}

// ------------------------------------------------------------- playlist ----

/**
 * Open the playlist modal.
 * @param {string|{id: string}} playlist - playlist or its id
 */
export async function openPlaylistDetails(playlist) {
    const playlistId = String(playlist?.id ?? playlist);
    const body = byId('modalTracks');

    byId('modalTitle').textContent = t('common.loading');
    byId('modalType').textContent = t('playlist.label');
    byId('modalCover').src = PLACEHOLDER_IMAGE;
    replace(body, loadingState(5));
    openModal('detailsModal');

    try {
        const all = await getPlaylists();
        currentPlaylist = all.find(p => String(p.id) === playlistId);
        if (!currentPlaylist) {
            replace(body, errorState(t('common.notFound')));
            return;
        }

        const list = currentPlaylist;
        const tracks = list.PlaylistTracks || [];

        byId('modalTitle').textContent = list.name;
        byId('modalType').textContent = `${t('playlist.label')} · ${tracks.length} ${t('common.songs')}`;
        byId('modalCover').src = list.coverImage || PLACEHOLDER_IMAGE;

        const actions = el('div', {
            style: 'display:flex;flex-wrap:wrap;gap:8px;padding:16px 0;border-bottom:1px solid var(--border)'
        }, [
            button(t('playlist.changeCover'), () => {
                coverData = null;
                byId('coverUrlInput').value = '';
                byId('coverPreviewContainer').classList.add('hidden');
                setCoverTab('upload');
                openModal('changeCoverModal');
            }, GHOST_BUTTON),
            button(t('playlist.delete'), () => showConfirmModal({
                title: t('playlist.deleteTitle'),
                message: t('playlist.deleteBody', { name: list.name }),
                confirmText: t('playlist.deleteConfirm'),
                onConfirm: async () => {
                    if (await deletePlaylist(list.id)) {
                        closeModal('detailsModal');
                        window.router?.handleRoute();
                    }
                }
            }), DANGER_BUTTON)
        ]);

        replace(body, actions, tracks.length
            ? el('div', { className: 'ma-rows', style: 'border-top:0' }, tracks.map(entry => trackRow(
                {
                    id: entry.trackId,
                    name: entry.trackName,
                    artist: entry.artistName || '',
                    image: entry.image,
                    preview_url: entry.previewUrl
                },
                async () => {
                    if (await removeFromPlaylist(list.id, entry.trackId)) {
                        await openPlaylistDetails(list.id);
                    }
                }
            )))
            : emptyState('≡', t('playlist.empty')));
    } catch (error) {
        replace(body, errorState(t('playlist.loadFailed'), error.message || ''));
    }
}

/**
 * Offer the user's playlists for the open track.
 */
export async function addToPlaylistFromDetail() {
    if (!store.token) return window.openAuthModal?.();

    const target = byId('playlistOptions');
    replace(target, loadingState(3));
    openModal('addToPlaylistModal');

    const lists = await getPlaylists();
    if (!lists.length) {
        replace(target, emptyState('≡', t('playlist.chooseFirst')));
        return;
    }

    replace(target, ...lists.map(list => el('button', {
        className: 'ma-row',
        attrs: { type: 'button' },
        on: {
            click: async () => {
                if (await addToPlaylist(list.id, currentTrack)) {
                    closeModal('addToPlaylistModal');
                    await getPlaylists();
                }
            }
        }
    }, [
        cover(list.coverImage, list.name || '', 'ma-cover-sm'),
        el('span', { className: 'ma-row-main ma-row-title', text: list.name }),
        el('span', {
            style: 'font-size:11px;color:var(--ink3);flex:0 0 auto',
            text: `${list.trackCount ?? list.PlaylistTracks?.length ?? 0} ${t('common.songs')}`
        })
    ])));
}

// ------------------------------------------------------------ cover art ----

/**
 * @param {'upload'|'url'} tab
 */
export function setCoverTab(tab) {
    const upload = tab !== 'url';
    byId('coverUploadSection').classList.toggle('hidden', !upload);
    byId('coverUrlSection').classList.toggle('hidden', upload);
    byId('coverTabUpload').className = `flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${upload ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-text-secondary-light dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`;
    byId('coverTabUrl').className = `flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${upload ? 'bg-gray-100 dark:bg-gray-700 text-text-secondary-light dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' : 'bg-blue-500 text-white'}`;
    if (!upload) coverData = null;
}

/**
 * @param {Event} event
 */
export function handleCoverFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
        showToast(`❌ ${t('cover.tooLarge')}`, 'error');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        coverData = reader.result;
        byId('coverPreviewImg').src = coverData;
        byId('coverPreviewContainer').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

/**
 * Save the chosen cover onto the open playlist.
 */
export async function confirmCoverChange() {
    if (!currentPlaylist) return;
    try {
        await put(`/playlists/${encodeURIComponent(currentPlaylist.id)}/cover`, {
            coverImage: coverData || byId('coverUrlInput').value.trim() || null
        });
        closeModal('changeCoverModal');
        await openPlaylistDetails(currentPlaylist.id);
    } catch (error) {
        reportError(error);
    }
}

/**
 * Expose the handlers other modules still reach through `window` (views open
 * detail modals by name so they do not need to import this module).
 */
export function initDetails() {
    Object.assign(window, {
        openAlbumDetail,
        openAlbumModal: openAlbumDetail,
        openTrackDetail,
        openPlaylistDetails
    });
}
