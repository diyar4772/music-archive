import { performSearch } from '../services/search.js';
import { get, post, put } from '../services/api.js';
import { store } from '../state/store.js';
import { getPlaylists, likeTrack, unlikeTrack, isTrackLiked, addToPlaylist, removeFromPlaylist, deletePlaylist } from '../services/library.js';
import { rateTrack, removeRating, getTrackRating } from '../services/rating.js';
import { playTrack } from './MiniPlayer.js';
import { openModal, closeModal, showConfirmModal } from './Modal.js';
import { showToast } from '../utils.js';

let currentTrack;
let currentPlaylist;
let coverData = null;
const el = id => document.getElementById(id);
const placeholder = '/js/placeholder.svg';
const button = (text, action) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'px-3 py-2 rounded-lg bg-green-500 text-white text-sm';
    node.textContent = text;
    node.addEventListener('click', action);
    return node;
};
const reportError = error => showToast(error.message || 'İşlem tamamlanamadı');

function ratingControl(container, item) {
    container.replaceChildren();
    const select = document.createElement('select');
    select.className = 'p-2 rounded-lg bg-gray-100 dark:bg-card-dark';
    select.setAttribute('aria-label', 'Puan');
    const current = getTrackRating(item.id, item.itemType || 'track');
    for (let score = 0; score <= 5; score += 0.5) {
        const option = document.createElement('option');
        option.value = String(score);
        option.textContent = score ? `${score} ★` : 'Puan yok';
        option.selected = score === (current || 0);
        select.append(option);
    }
    select.addEventListener('change', async () => {
        if (!store.token) { window.openAuthModal(); select.value = String(current || 0); return; }
        const score = Number(select.value);
        const ok = score ? await rateTrack(item.id, score, { itemType: item.itemType || 'track', itemName: item.name, artistName: item.artist, image: item.image })
            : await removeRating(item.id, item.itemType || 'track');
        if (!ok) select.value = String(getTrackRating(item.id, item.itemType || 'track') || 0);
    });
    container.append(select);
}

function trackRow(track, remove) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-3 p-3 border-b border-gray-500/20';
    const image = document.createElement('img');
    image.src = track.image || placeholder;
    image.className = 'w-12 h-12 rounded object-cover';
    const title = button(track.name, () => openTrackDetail(track.id, track.name, track.artist, track.image, track.preview_url));
    title.className = 'flex-1 min-w-0 text-left truncate';
    row.append(image, title, button('▶', () => playTrack(track)));
    if (remove) row.append(button('Kaldır', remove));
    return row;
}

export async function openAlbumDetail(id) {
    try {
        const album = await get(`/album/${encodeURIComponent(id)}`);
        el('modalTitle').textContent = album.name;
        el('modalType').textContent = album.artist;
        el('modalCover').src = album.image || placeholder;
        const tracks = el('modalTracks'); tracks.replaceChildren();
        const rating = document.createElement('div');
        ratingControl(rating, { ...album, itemType: 'album' }); tracks.append(rating);
        for (const track of album.tracks) tracks.append(trackRow({ ...track, artist: album.artist, image: album.image }));
        openModal('detailsModal');
    } catch (error) { reportError(error); }
}

export function openTrackDetail(id, name, artist, image, preview) {
    const stored = store.likedTracks.find(t => t.trackId === id);
    currentTrack = { id, name: name || stored?.trackName || '', artist: artist || stored?.artistName || '', image: image || stored?.image, preview_url: preview || stored?.previewUrl };
    el('trackDetailName').textContent = currentTrack.name;
    el('trackDetailArtist').textContent = currentTrack.artist;
    el('trackDetailImage').src = currentTrack.image || placeholder;
    el('trackDetailNote').value = stored?.userNote || '';
    el('trackNoteSaveBtn').classList.add('hidden');
    el('trackDetailLikeText').textContent = isTrackLiked(id) ? 'Beğeniyi kaldır' : 'Beğen';
    el('trackDetailLikeIcon').className = isTrackLiked(id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    el('trackDetailPlayBtn').classList.remove('hidden');
    const query = encodeURIComponent(`${currentTrack.name} ${currentTrack.artist}`);
    el('trackSpotifyLink').href = `https://open.spotify.com/track/${encodeURIComponent(id)}`;
    el('trackYoutubeLink').href = `https://www.youtube.com/results?search_query=${query}`;
    el('trackAppleMusicLink').href = `https://music.apple.com/search?term=${query}`;
    ratingControl(el('trackDetailRating'), currentTrack);
    el('trackDetailContent').classList.remove('translate-y-full');
    openModal('trackDetailModal', 'trackDetailContent');
}

async function playCurrentTrack() {
    try {
        if (!currentTrack.preview_url) {
            const results = await performSearch(`${currentTrack.name} ${currentTrack.artist}`, 'track');
            currentTrack.preview_url = results.find(track => track.id === currentTrack.id)?.preview_url;
        }
        playTrack(currentTrack);
    } catch (error) { reportError(error); }
}

export async function openPlaylistDetails(playlist) {
    try {
        const all = await getPlaylists();
        currentPlaylist = all.find(p => String(p.id) === String(playlist.id || playlist));
        if (!currentPlaylist) return;
        const p = currentPlaylist;
        el('modalTitle').textContent = p.name;
        el('modalType').textContent = 'Playlist';
        el('modalCover').src = p.coverImage || placeholder;
        const content = el('modalTracks'); content.replaceChildren();
        const actions = document.createElement('div'); actions.className = 'flex gap-3 mb-4';
        actions.append(button('Kapak değiştir', () => {
            coverData = null; el('coverUrlInput').value = ''; openModal('changeCoverModal');
        }), button('Listeyi sil', () => showConfirmModal({ title: 'Liste silinsin mi?', onConfirm: async () => {
            if (await deletePlaylist(p.id)) { closeModal('detailsModal'); window.router?.handleRoute(); }
        } })));
        content.append(actions);
        for (const t of p.PlaylistTracks || []) {
            content.append(trackRow({ id: t.trackId, name: t.trackName, artist: t.artistName || '', image: t.image, preview_url: t.previewUrl }, async () => {
                if (await removeFromPlaylist(p.id, t.trackId)) await openPlaylistDetails(p.id);
            }));
        }
        openModal('detailsModal');
    } catch (error) { reportError(error); }
}

async function choosePlaylist() {
    if (!store.token) return window.openAuthModal();
    const lists = await getPlaylists();
    const target = el('playlistOptions'); target.replaceChildren();
    if (!lists.length) target.textContent = 'Önce bir liste oluşturun.';
    for (const list of lists) target.append(button(list.name, async () => {
        if (await addToPlaylist(list.id, currentTrack)) { closeModal('addToPlaylistModal'); await getPlaylists(); }
    }));
    openModal('addToPlaylistModal');
}

export function initDetails() {
    Object.assign(window, {
        openAlbumDetail, openAlbumModal: openAlbumDetail, openTrackDetail, openPlaylistDetails,
        closeDetailsModal: () => closeModal('detailsModal'),
        closeTrackDetail: () => closeModal('trackDetailModal', 'trackDetailContent'),
        playTrackFromDetail: playCurrentTrack,
        addToPlaylistFromDetail: choosePlaylist,
        closeAddToPlaylistModal: () => closeModal('addToPlaylistModal'),
        closeChangeCoverModal: () => closeModal('changeCoverModal'),
        showNoteSaveBtn: () => el('trackNoteSaveBtn').classList.remove('hidden'),
        toggleLikeFromDetail: async () => {
            if (!store.token) return window.openAuthModal();
            const t = currentTrack;
            const ok = isTrackLiked(t.id) ? await unlikeTrack(t.id) : await likeTrack(t);
            if (ok) openTrackDetail(t.id, t.name, t.artist, t.image, t.preview_url);
        },
        saveTrackNote: async () => {
            try {
                await post('/library/note', { spotifyId: currentTrack.id, note: el('trackDetailNote').value });
                const track = store.likedTracks.find(t => t.trackId === currentTrack.id);
                if (track) track.userNote = el('trackDetailNote').value;
                el('trackNoteSaveBtn').classList.add('hidden'); showToast('Not kaydedildi');
            } catch (error) { reportError(error); }
        },
        setCoverTab: tab => {
            el('coverUploadSection').classList.toggle('hidden', tab !== 'upload');
            el('coverUrlSection').classList.toggle('hidden', tab !== 'url');
            if (tab === 'url') coverData = null;
        },
        handleCoverFileSelect: event => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return showToast('2 MB altında bir görsel seçin');
            const reader = new FileReader();
            reader.onload = () => { coverData = reader.result; el('coverPreviewImg').src = coverData; el('coverPreviewContainer').classList.remove('hidden'); };
            reader.readAsDataURL(file);
        },
        confirmCoverChange: async () => {
            try {
                await put(`/playlists/${encodeURIComponent(currentPlaylist.id)}/cover`, { coverImage: coverData || el('coverUrlInput').value.trim() || null });
                closeModal('changeCoverModal'); await openPlaylistDetails(currentPlaylist.id);
            } catch (error) { reportError(error); }
        }
    });
}
