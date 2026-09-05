// Statistics Cards Component
import { store } from '../state/store.js';
import { getAverageRating } from '../services/rating.js';

/**
 * Create stat card HTML
 * @param {Object} options - Card options
 */
function createStatCard({ value, label, gradient, icon }) {
    return `
        <div class="stat-card bg-gradient-to-br ${gradient} p-5 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-200">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-3xl font-bold">${value}</div>
                    <div class="text-sm opacity-80">${label}</div>
                </div>
                ${icon ? `<i class="${icon} text-3xl opacity-60"></i>` : ''}
            </div>
        </div>
    `;
}

/**
 * Render all stat cards
 * @param {string} containerId - Container element ID
 */
export function renderStatCards(containerId = 'statCardsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cards = [
        {
            value: store.likedTracks.length,
            label: 'Şarkı',
            gradient: 'from-green-600 to-green-800',
            icon: 'fa-solid fa-music'
        },
        {
            value: store.followedArtists.length,
            label: 'Sanatçı',
            gradient: 'from-purple-600 to-purple-800',
            icon: 'fa-solid fa-user'
        },
        {
            value: store.playlists.length,
            label: 'Liste',
            gradient: 'from-blue-600 to-blue-800',
            icon: 'fa-solid fa-list'
        },
        {
            value: `⭐ ${getAverageRating() || '–'}`,
            label: 'Ort. Puan',
            gradient: 'from-amber-600 to-amber-800',
            icon: 'fa-solid fa-star'
        }
    ];

    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            ${cards.map(createStatCard).join('')}
        </div>
    `;
}

/**
 * Update a single stat card value
 * @param {string} type - Stat type (tracks, artists, playlists, rating)
 */
export function updateStatCard(type) {
    const values = {
        tracks: store.likedTracks.length,
        artists: store.followedArtists.length,
        playlists: store.playlists.length,
        rating: getAverageRating() || '–'
    };

    // Could implement targeted updates for better performance
    renderStatCards();
}

