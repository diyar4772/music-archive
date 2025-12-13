import { renderArtistCards } from './components/ArtistCard.js';
import { ModalController, createArtistModalContent } from './components/Modal.js';
import { AddArtistFormController } from './components/AddArtistForm.js';
import { AlbumModalController } from './components/AlbumModal.js';

import { spotifyService } from './services/spotify.js';

// Application State
const state = {
    artists: [],
    currentArtist: null,
    searchQuery: '',
    filterGenre: 'all'
};

// DOM Elements
const elements = {
    artistGrid: document.getElementById('artistsGrid'),
    searchInput: document.getElementById('searchArtist'),
    genreFilter: document.getElementById('genreFilter'),
    artistModal: null,
    albumModal: null,
    addArtistForm: null
};

// Data Service'i override ediyoruz - artık Spotify destekli
async function loadArtists() {
    // 1. Local JSON'dan listeyi al
    let baseList = [];
    try {
        const response = await fetch('js/data/artists.json?v=' + Date.now());
        baseList = await response.json();
    } catch (e) {
        console.error("Local veri yüklenemedi", e);
        baseList = [];
    }

    // 2. Spotify'dan verileri zenginleştir
    const enrichedList = await Promise.all(baseList.map(async (localArtist) => {
        try {
            let spotifyData = null;

            if (localArtist.spotifyId) {
                // ID varsa direkt çek
                spotifyData = await spotifyService.getArtist(localArtist.spotifyId);
            } else {
                // ID yoksa isimle ara
                spotifyData = await spotifyService.searchArtist(localArtist.name);
            }

            if (spotifyData) {
                return {
                    ...localArtist,
                    id: localArtist.id, // Kendi ID'mizi koru
                    spotifyId: spotifyData.id,
                    name: spotifyData.name, // Spotify'daki resmi ismi kullan
                    image: spotifyData.images && spotifyData.images.length > 0 ? spotifyData.images[0].url : null,
                    genres: spotifyData.genres,
                    popularity: spotifyData.popularity,
                    spotifyUrl: spotifyData.external_urls.spotify
                };
            }
            return localArtist;
        } catch (error) {
            console.error(`Error fetching data for ${localArtist.name}:`, error);
            return localArtist;
        }
    }));

    state.artists = enrichedList;
    renderArtistCards(state.artists, elements.artistGrid);
}

/**
 * Initialize Application
 */
async function init() {
    console.log('Uygulama başlatılıyor...');

    // Initialize Modals
    elements.artistModal = new ModalController('modalOverlay', 'artistModal', 'modalClose', 'modalContent');
    elements.albumModal = new AlbumModalController({
        onClose: () => {
            console.log('Albüm modal kapatıldı');
        }
    });

    // Initialize Add Artist Form
    elements.addArtistForm = new AddArtistFormController({
        overlayId: 'addArtistOverlay',
        closeButtonId: 'addArtistClose',
        openButtonId: 'addArtistBtn',
        formId: 'addArtistForm',
        onSubmit: handleAddArtist
    });

    // Setup Event Listeners
    setupEventListeners();

    // Load Data
    await loadArtists();
    console.log('Veriler yüklendi');
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // Search Input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        filterArtists();
    });

    // Genre Filter
    elements.genreFilter.addEventListener('change', (e) => {
        state.filterGenre = e.target.value;
        filterArtists();
    });

    // Delegated Event Listeners for Cards
    document.addEventListener('click', async (e) => {
        const artistCard = e.target.closest('.artist-card');
        if (artistCard) {
            const artistId = artistCard.dataset.artistId;
            await handleArtistClick(artistId);
        }
    });

    // Album Click Listener
    // Note: This is now handled within the modal content rendering or separate delegation
    // But since modal content is dynamic, we attach listener to document for modal elements too
    document.addEventListener('click', handleAlbumClick);
}

/**
 * Handle artist card click - Fetch details from Spotify
 */
async function handleArtistClick(artistId) {
    const artist = state.artists.find(a => a.id === artistId);
    if (!artist) return;

    state.currentArtist = artist;

    // Open modal with loading state
    elements.artistModal.open('<div style="text-align:center; padding: 2rem;">Yükleniyor...</div>');

    try {
        // Fetch albums from Spotify
        let albums = [];
        if (artist.spotifyId) {
            const spotifyAlbums = await spotifyService.getArtistAlbums(artist.spotifyId);
            // Map Spotify albums to our format
            albums = spotifyAlbums.map(album => ({
                id: album.id,
                title: album.name,
                image: album.images && album.images.length > 0 ? album.images[0].url : null,
                year: album.release_date.substring(0, 4),
                spotifyId: album.id,
                totalTracks: album.total_tracks
            }));

            // Remove duplicates (Spotify sometimes returns same album in different markets)
            albums = albums.filter((v, i, a) => a.findIndex(t => (t.title === v.title)) === i);
        }

        // Update artist object with albums
        const artistWithAlbums = { ...artist, albums };

        // Render Full Modal Content
        // We need to adapt createArtistModalContent to handle new data structure if needed
        const content = createArtistModalContent(artistWithAlbums);

        // Re-open/Update modal content
        const modalContentEl = document.getElementById('modalContent');
        if (modalContentEl) modalContentEl.innerHTML = content;

    } catch (error) {
        console.error("Albüm detayı çekilemedi:", error);
        elements.artistModal.open('<div style="text-align:center; color:red;">Veri yüklenemedi.</div>');
    }
}

/**
 * Handle album card click inside Artist Modal
 */
async function handleAlbumClick(e) {
    const albumCard = e.target.closest('.album-card');
    if (!albumCard) return;

    const albumId = albumCard.dataset.albumId;
    if (!albumId) return;

    // Show loading in album modal? Or just open it
    // Best UX: Open modal with loading spinner, then fetch tracks

    // We need album details. If we have it in memory:
    // But track list is NOT in memory efficiently. We fetch it now.

    const artist = state.currentArtist;
    // Find album basic info from artist.albums (which we populated in handleArtistClick)
    // Note: createArtistModalContent renders .album-card with data-album-id which is spotify ID now

    // Find the album in the currently open artist albums list (which we attached to DOM or state?)
    // In handleArtistClick we created `artistWithAlbums`. We didn't save it to state.currenArtist fully.
    // Let's assume we can fetch album details again or find it.

    // Easier: Just fetch album details from Spotify by ID

    try {
        elements.albumModal.open({ title: 'Yükleniyor...', tracks: [] }, artist.name, artist.spotifyId);

        const tracks = await spotifyService.getAlbumTracks(albumId);
        const albumDetails = await spotifyService.getAlbum(albumId);

        const fullAlbum = {
            id: albumDetails.id,
            title: albumDetails.name,
            cover: albumDetails.images && albumDetails.images.length > 0 ? albumDetails.images[0].url : null,
            year: albumDetails.release_date.substring(0, 4),
            spotifyId: albumDetails.id,
            tracks: tracks.map(t => ({
                title: t.name,
                duration: msToTime(t.duration_ms),
                preview_url: t.preview_url,
                spotifyId: t.id
            }))
        };

        // Update Modal
        elements.albumModal.open(fullAlbum, artist.name, artist.spotifyId);

    } catch (error) {
        console.error("Albüm şarkıları çekilemedi:", error);
    }
}

// Opsiyonel: Saniye -> Dakika:Saniye çevirici
function msToTime(duration) {
    var milliseconds = Math.floor((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60);

    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return minutes + ":" + seconds;
}


function filterArtists() {
    const query = state.searchQuery;
    const genre = state.filterGenre;

    const filtered = state.artists.filter(artist => {
        const matchesSearch = artist.name.toLowerCase().includes(query) ||
            (artist.genre && artist.genre.toLowerCase().includes(query));
        const matchesGenre = genre === 'all' || (artist.genre && artist.genre.toLowerCase().includes(genre.toLowerCase())) ||
            (artist.genres && artist.genres.some(g => g.includes(genre.toLowerCase())));

        return matchesSearch && matchesGenre;
    });

    renderArtistCards(filtered, elements.artistGrid);
}

function handleAddArtist(formData) {
    // Bu fonksiyonu şimdilik pasifize edebiliriz veya Spotify search ile entegre edebiliriz
    // Manuel ekleme yerine "Arama" daha mantıklı.
    console.log("Manuel ekleme devre dışı, otomatik kullanılıyor.");
}

// Start app
document.addEventListener('DOMContentLoaded', init);
