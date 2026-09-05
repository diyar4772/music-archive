// Dashboard Component
import { store } from '../state/store.js';
import { getAverageRating, getTopRatedTracks } from '../services/rating.js';
import { formatDate } from '../utils.js';

/**
 * Render collection statistics cards
 */
export function renderStatCards() {
    const container = document.getElementById('statCardsContainer');
    if (!container) return;

    const stats = getCollectionStats();

    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-gradient-to-br from-green-600 to-green-800 p-5 rounded-xl shadow-lg">
                <div class="text-3xl font-bold">${stats.totalTracks}</div>
                <div class="text-sm text-green-200">Şarkı</div>
            </div>
            <div class="bg-gradient-to-br from-purple-600 to-purple-800 p-5 rounded-xl shadow-lg">
                <div class="text-3xl font-bold">${stats.totalArtists}</div>
                <div class="text-sm text-purple-200">Sanatçı</div>
            </div>
            <div class="bg-gradient-to-br from-blue-600 to-blue-800 p-5 rounded-xl shadow-lg">
                <div class="text-3xl font-bold">${stats.totalPlaylists}</div>
                <div class="text-sm text-blue-200">Liste</div>
            </div>
            <div class="bg-gradient-to-br from-amber-600 to-amber-800 p-5 rounded-xl shadow-lg">
                <div class="text-3xl font-bold">⭐ ${stats.avgRating}</div>
                <div class="text-sm text-amber-200">Ort. Puan</div>
            </div>
        </div>
    `;
}

/**
 * Get collection statistics
 */
export function getCollectionStats() {
    return {
        totalTracks: store.likedTracks.length,
        totalArtists: store.followedArtists.length,
        totalPlaylists: store.playlists.length,
        avgRating: getAverageRating() || '–'
    };
}

/**
 * Render recently added tracks
 */
export function renderRecentlyAdded() {
    const container = document.getElementById('recentlyAddedContainer');
    if (!container) return;

    // Sort by added date (assuming createdAt field)
    const recentTracks = [...store.likedTracks]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 5);

    if (recentTracks.length === 0) {
        container.innerHTML = `
            <div class="text-gray-400 text-center py-4">
                <i class="fa-solid fa-music text-2xl mb-2"></i>
                <p>Henüz şarkı eklenmedi</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
            <i class="fa-solid fa-clock text-green-500"></i>
            Son Eklenenler
        </h3>
        <div class="space-y-2">
            ${recentTracks.map(track => `
                <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-[#282828] transition cursor-pointer"
                     onclick="openTrackDetail('${track.trackId}')">
                    <img src="${track.image || 'https://via.placeholder.com/40'}" 
                         class="w-10 h-10 rounded object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">${track.trackName}</div>
                        <div class="text-xs text-gray-400 truncate">${track.artist}</div>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${track.createdAt ? formatDate(track.createdAt) : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render top rated tracks section
 */
export function renderTopRated() {
    const container = document.getElementById('topRatedContainer');
    if (!container) return;

    const topTracks = getTopRatedTracks(5);

    if (topTracks.length === 0) {
        container.innerHTML = `
            <div class="text-gray-400 text-center py-4">
                <i class="fa-solid fa-star text-2xl mb-2"></i>
                <p>Henüz puan verilmedi</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
            <i class="fa-solid fa-trophy text-amber-500"></i>
            En Yüksek Puanlı
        </h3>
        <div class="space-y-2">
            ${topTracks.map((track, index) => `
                <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-[#282828] transition cursor-pointer"
                     onclick="openTrackDetail('${track.trackId}')">
                    <div class="w-6 text-center font-bold ${index < 3 ? 'text-amber-500' : 'text-gray-500'}">
                        ${index + 1}
                    </div>
                    <img src="${track.image || 'https://via.placeholder.com/40'}" 
                         class="w-10 h-10 rounded object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">${track.trackName}</div>
                        <div class="text-xs text-gray-400 truncate">${track.artist}</div>
                    </div>
                    <div class="flex items-center gap-1 text-amber-500">
                        <i class="fa-solid fa-star text-sm"></i>
                        <span class="font-bold">${track.rating}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Initialize dashboard
 */
export function initDashboard() {
    // Subscribe to data changes
    store.subscribe('likedTracks', () => {
        renderStatCards();
        renderRecentlyAdded();
    });

    store.subscribe('followedArtists', () => {
        renderStatCards();
    });

    store.subscribe('playlists', () => {
        renderStatCards();
    });

    store.subscribe('userRatings', () => {
        renderStatCards();
        renderTopRated();
    });

    // Initial render
    renderStatCards();
    renderRecentlyAdded();
    renderTopRated();
}

/**
 * Show dashboard and hide results
 */
export function showDashboard() {
    document.getElementById('results')?.classList.add('hidden');
    document.getElementById('dashboard')?.classList.remove('hidden');
    document.getElementById('searchInput').value = '';
}

// Expose to global for inline handlers
window.showDashboard = showDashboard;

