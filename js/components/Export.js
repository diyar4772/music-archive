// CSV Export Component
import { store } from '../state/store.js';
import { getTrackRating } from '../services/rating.js';
import { showToast, formatDate } from '../utils.js';

/**
 * Export liked tracks to CSV
 */
export function exportToCSV() {
    if (store.likedTracks.length === 0) {
        showToast('❌ Dışa aktarılacak şarkı yok');
        return;
    }

    // CSV headers
    const headers = ['Şarkı Adı', 'Sanatçı', 'Albüm', 'Puan', 'Eklenme Tarihi'];

    // Build rows
    const rows = store.likedTracks.map(track => {
        const rating = getTrackRating(track.trackId) || '';
        const date = track.createdAt ? formatDate(track.createdAt) : '';

        return [
            escapeCSV(track.trackName),
            escapeCSV(track.artist),
            escapeCSV(track.album || ''),
            rating,
            date
        ];
    });

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    downloadFile(csvContent, `koleksiyon_${getDateString()}.csv`, 'text/csv');
    showToast('✅ CSV dosyası indirildi');
}

/**
 * Export collection statistics
 */
export function exportStats() {
    const stats = {
        exportDate: new Date().toISOString(),
        totalTracks: store.likedTracks.length,
        totalArtists: store.followedArtists.length,
        totalPlaylists: store.playlists.length,
        tracks: store.likedTracks.map(t => ({
            name: t.trackName,
            artist: t.artist,
            album: t.album,
            rating: getTrackRating(t.trackId),
            addedAt: t.createdAt
        })),
        artists: store.followedArtists.map(a => ({
            name: a.artistName,
            id: a.artistId
        })),
        playlists: store.playlists.map(p => ({
            name: p.name,
            trackCount: p.tracks?.length || 0
        }))
    };

    const jsonContent = JSON.stringify(stats, null, 2);
    downloadFile(jsonContent, `koleksiyon_yedek_${getDateString()}.json`, 'application/json');
    showToast('✅ JSON yedek dosyası indirildi');
}

/**
 * Escape special characters for CSV
 */
function escapeCSV(str) {
    if (!str) return '';
    // If contains comma, newline or quote, wrap in quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Get date string for filename
 */
function getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Download file helper
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Render export button in UI
 */
export function renderExportButton(containerId = 'exportContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="flex gap-2">
            <button onclick="exportToCSV()" 
                    class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition">
                <i class="fa-solid fa-file-csv"></i>
                CSV İndir
            </button>
            <button onclick="exportStats()" 
                    class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition">
                <i class="fa-solid fa-file-code"></i>
                JSON Yedek
            </button>
        </div>
    `;
}

// Expose to global for inline handlers
window.exportToCSV = exportToCSV;
window.exportStats = exportStats;

