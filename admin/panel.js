'use strict';

let currentSearch = '';
let currentSortBy = 'createdAt';
let currentSortOrder = 'desc';
let searchTimeout = null;
let currentAudio = null;
let playingTrackId = null;
let previewTracks = [];

const byId = (id) => document.getElementById(id);

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[character]);

const adminFetch = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (response.status === 403) {
        window.location.replace('/admin/login');
        throw new Error('Admin session expired');
    }
    return response;
};

const requireOk = async (response) => {
    if (response.ok) return response;
    let message = `HTTP ${response.status}`;
    try {
        const body = await response.json();
        if (body.error) message = body.error;
    } catch (_error) {
        // The status code remains useful when an upstream returned no JSON.
    }
    throw new Error(message);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const updateSortIcons = () => {
    document.querySelectorAll('.sort-icon').forEach((icon) => {
        const field = icon.dataset.field;
        icon.className = field === currentSortBy
            ? `fa-solid fa-sort-${currentSortOrder === 'desc' ? 'down' : 'up'} ml-1 sort-icon text-green-400`
            : 'fa-solid fa-sort ml-1 sort-icon';
        icon.dataset.field = field;
    });
};

const loadStats = async () => {
    try {
        const response = await requireOk(await adminFetch('/api/admin/stats'));
        const data = await response.json();
        byId('statUsers').textContent = data.totalUsers || 0;
        byId('statLikes').textContent = data.totalLikes || 0;
        byId('statFollows').textContent = data.totalFollows || 0;
        byId('statAlbums').textContent = data.totalAlbumFollows || 0;
        byId('statPlaylists').textContent = data.totalPlaylists || 0;
    } catch (error) {
        console.error('Stats load error:', error);
    }
};

const loadUsers = async () => {
    const table = byId('usersTable');
    try {
        const params = new URLSearchParams();
        if (currentSearch) params.append('search', currentSearch);
        params.append('sortBy', currentSortBy);
        params.append('sortOrder', currentSortOrder);

        const response = await requireOk(await adminFetch(`/api/admin/users?${params}`));
        const data = await response.json();
        byId('userCount').textContent = `(${data.total || 0})`;

        if (!data.users?.length) {
            table.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-gray-500">${currentSearch ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}</td></tr>`;
            return;
        }

        table.innerHTML = data.users.map((user) => {
            const userId = escapeHtml(user.id);
            const username = escapeHtml(user.username);
            return `
                <tr class="user-row transition cursor-pointer" data-action="view-user" data-user-id="${userId}">
                    <td class="p-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                                ${username.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                                <p class="font-bold">${username}</p>
                                ${user.isAdmin ? '<span class="text-xs bg-red-500/30 text-red-400 px-2 py-0.5 rounded">Admin</span>' : ''}
                            </div>
                        </div>
                    </td>
                    <td class="p-4 text-gray-400 text-sm">${formatDate(user.createdAt)}</td>
                    <td class="p-4 text-gray-400 text-sm">${user.lastLogin ? formatDate(user.lastLogin) : 'Hiç giriş yapmadı'}</td>
                    <td class="p-4">${user.loginCount || 0}</td>
                    <td class="p-4"><span class="bg-pink-500/20 text-pink-400 px-2 py-1 rounded">${user.likesCount || 0}</span></td>
                    <td class="p-4"><span class="bg-green-500/20 text-green-400 px-2 py-1 rounded">${user.followsCount || 0}</span></td>
                    <td class="p-4"><span class="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">${user.playlistsCount || 0}</span></td>
                    <td class="p-4">
                        <button data-action="delete-user" data-user-id="${userId}" data-username="${username}"
                            class="text-red-400 hover:text-red-300 p-2" title="Kullanıcıyı Sil">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    } catch (error) {
        console.error('Users load error:', error);
        table.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-red-400">Kullanıcılar yüklenemedi</td></tr>';
    }
};

const viewUserDetail = async (userId) => {
    try {
        const [userResponse, loginsResponse] = await Promise.all([
            adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`),
            adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/logins`)
        ]);
        await Promise.all([requireOk(userResponse), requireOk(loginsResponse)]);
        const data = await userResponse.json();
        const loginsData = await loginsResponse.json();
        const username = escapeHtml(data.user.username);
        byId('detailUsername').textContent = `📊 ${data.user.username} - Detaylar`;

        const loginHistory = loginsData.loginHistory?.length ? `
            <div class="glass p-4 rounded-xl">
                <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-clock-rotate-left text-orange-400 mr-2"></i>Giriş Geçmişi (Son 10)</h4>
                <div class="space-y-1 max-h-40 overflow-y-auto">
                    ${loginsData.loginHistory.map((history, index) => `
                        <p class="text-sm ${index === 0 ? 'text-green-400' : 'text-gray-400'}">
                            <i class="${index === 0 ? 'fa-solid' : 'fa-regular'} fa-circle text-xs mr-2"></i>
                            ${formatDate(history.loginAt)}
                        </p>`).join('')}
                </div>
            </div>` : `
            <div class="glass p-4 rounded-xl">
                <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-clock-rotate-left text-orange-400 mr-2"></i>Giriş Geçmişi</h4>
                <p class="text-gray-500 text-sm">Henüz giriş kaydı yok</p>
            </div>`;

        byId('userDetailContent').innerHTML = `
            <div class="grid md:grid-cols-3 gap-6 mb-6">
                <div class="glass p-4 rounded-xl">
                    <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-user text-blue-400 mr-2"></i>Kullanıcı Bilgileri</h4>
                    <p class="text-gray-400">ID: <span class="text-white">${escapeHtml(data.user.id)}</span></p>
                    <p class="text-gray-400">Kullanıcı Adı: <span class="text-white">${username}</span></p>
                    <p class="text-gray-400">Kayıt: <span class="text-white">${formatDate(data.user.createdAt)}</span></p>
                    <p class="text-gray-400">Son Giriş: <span class="text-white">${data.user.lastLogin ? formatDate(data.user.lastLogin) : 'Hiç'}</span></p>
                    <p class="text-gray-400">Toplam Giriş: <span class="text-white">${data.user.loginCount || 0}</span></p>
                </div>
                <div class="glass p-4 rounded-xl">
                    <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-chart-bar text-green-400 mr-2"></i>İstatistikler</h4>
                    <p class="text-gray-400">Beğenilen Şarkılar: <span class="text-pink-400 font-bold">${data.likes?.length || 0}</span></p>
                    <p class="text-gray-400">Takip Edilen Sanatçılar: <span class="text-green-400 font-bold">${data.follows?.length || 0}</span></p>
                    <p class="text-gray-400">Takip Edilen Albümler: <span class="text-purple-400 font-bold">${data.albumFollows?.length || 0}</span></p>
                    <p class="text-gray-400">Playlistler: <span class="text-yellow-400 font-bold">${data.playlists?.length || 0}</span></p>
                </div>
                ${loginHistory}
            </div>
            ${data.likes?.length ? `
                <div class="mb-6">
                    <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-heart text-pink-400 mr-2"></i>Beğenilen Şarkılar (${data.likes.length})</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        ${data.likes.slice(0, 8).map((like) => `
                            <div class="glass p-3 rounded-lg flex items-center gap-3">
                                <img src="${escapeHtml(like.image || '/js/placeholder.svg')}" class="w-10 h-10 rounded object-cover" alt="">
                                <span class="text-sm truncate">${escapeHtml(like.trackName || 'Unknown')}</span>
                            </div>`).join('')}
                        ${data.likes.length > 8 ? `<div class="glass p-3 rounded-lg flex items-center justify-center text-gray-400">+${data.likes.length - 8} daha</div>` : ''}
                    </div>
                </div>` : ''}
            ${data.follows?.length ? `
                <div class="mb-6">
                    <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-user-plus text-green-400 mr-2"></i>Takip Edilen Sanatçılar (${data.follows.length})</h4>
                    <div class="flex flex-wrap gap-3">
                        ${data.follows.map((follow) => `
                            <div class="glass px-4 py-2 rounded-full flex items-center gap-2">
                                <img src="${escapeHtml(follow.image || '/js/placeholder.svg')}" class="w-6 h-6 rounded-full object-cover" alt="">
                                <span>${escapeHtml(follow.artistName || 'Unknown')}</span>
                            </div>`).join('')}
                    </div>
                </div>` : ''}
            ${data.playlists?.length ? `
                <div>
                    <h4 class="font-bold text-lg mb-3"><i class="fa-solid fa-list-ul text-yellow-400 mr-2"></i>Playlistler (${data.playlists.length})</h4>
                    <div class="grid md:grid-cols-2 gap-4">
                        ${data.playlists.map((playlist) => `
                            <div class="glass p-4 rounded-xl">
                                <p class="font-bold">${escapeHtml(playlist.name)}</p>
                                <p class="text-sm text-gray-400">${playlist.tracks?.length || 0} şarkı</p>
                            </div>`).join('')}
                    </div>
                </div>` : ''}`;
        byId('userDetailModal').classList.remove('hidden');
    } catch (error) {
        console.error('User detail error:', error);
        alert('Kullanıcı detayları yüklenemedi');
    }
};

const deleteUser = async (userId, username) => {
    if (!confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz ve tüm kullanıcı verileri silinecektir!`)) return;
    try {
        const response = await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        if (response.ok) {
            alert(`"${username}" kullanıcısı başarıyla silindi`);
            await Promise.all([loadStats(), loadUsers()]);
            return;
        }
        const data = await response.json();
        alert(`Hata: ${data.error || 'Kullanıcı silinemedi'}`);
    } catch (error) {
        console.error('Delete error:', error);
        alert('Kullanıcı silinirken bir hata oluştu');
    }
};

const switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach((element) => element.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach((element) => element.classList.remove('active'));
    const suffix = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    byId(`content${suffix}`).classList.remove('hidden');
    byId(`tab${suffix}`).classList.add('active');
};

const logTest = (elementId, message, type = 'info') => {
    const element = byId(elementId);
    const time = new Date().toLocaleTimeString();
    const color = type === 'ok' ? 'text-green-400' : type === 'error' ? 'text-red-400' : type === 'warn' ? 'text-yellow-400' : 'text-gray-300';
    element.insertAdjacentHTML('beforeend', `<div class="${color}">[${time}] ${escapeHtml(message)}</div>`);
    element.scrollTop = element.scrollHeight;
};

const testAPI = async () => {
    byId('apiTestResult').innerHTML = '';
    logTest('apiTestResult', 'API bağlantısı test ediliyor...');
    try {
        const start = Date.now();
        const response = await fetch('/api/search?artist=test&type=artist', { credentials: 'same-origin' });
        const elapsed = Date.now() - start;
        if (response.ok) {
            logTest('apiTestResult', `✅ API çalışıyor (${elapsed}ms)`, 'ok');
            byId('serverStatus').textContent = 'Çalışıyor';
            byId('serverStatus').className = 'text-green-400';
        } else {
            logTest('apiTestResult', `⚠️ API yanıt verdi ama hata: ${response.status}`, 'warn');
        }
    } catch (error) {
        logTest('apiTestResult', `❌ API bağlantı hatası: ${error.message}`, 'error');
        byId('serverStatus').textContent = 'Hata';
        byId('serverStatus').className = 'text-red-400';
    }
};

const testSpotify = async () => {
    logTest('apiTestResult', 'Spotify API test ediliyor...');
    try {
        const response = await fetch('/api/search?artist=Daft%20Punk&type=track', { credentials: 'same-origin' });
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            logTest('apiTestResult', `✅ Spotify API çalışıyor. ${data.length} sonuç bulundu.`, 'ok');
            const withPreview = data.filter((track) => track.preview_url);
            logTest('apiTestResult', `   └─ Preview URL'li: ${withPreview.length}/${data.length}`, withPreview.length > 0 ? 'ok' : 'warn');
            byId('dbType').textContent = 'MongoDB/In-Memory';
        } else {
            logTest('apiTestResult', '⚠️ Spotify sonuç döndürmedi', 'warn');
        }
    } catch (error) {
        logTest('apiTestResult', `❌ Spotify API hatası: ${error.message}`, 'error');
    }
};

const testSearch = async () => {
    const query = byId('testSearchQuery').value;
    const type = byId('testSearchType').value;
    byId('searchTestResult').innerHTML = '';
    logTest('searchTestResult', `Aranıyor: "${query}" (${type})`);
    try {
        const response = await fetch(`/api/search?artist=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`, { credentials: 'same-origin' });
        const data = await response.json();
        if (Array.isArray(data)) {
            logTest('searchTestResult', `✅ ${data.length} sonuç bulundu`, 'ok');
            data.slice(0, 5).forEach((item) => {
                const name = item.name || item.trackName || 'Unknown';
                logTest('searchTestResult', `   └─ ${name} ${item.preview_url ? '🎵' : ''}`);
            });
        } else if (data.name) {
            logTest('searchTestResult', `✅ Sanatçı: ${data.name}`, 'ok');
            logTest('searchTestResult', `   └─ Albüm sayısı: ${data.albums?.length || 0}`);
        }
    } catch (error) {
        logTest('searchTestResult', `❌ Arama hatası: ${error.message}`, 'error');
    }
};

const runAllTests = async () => {
    const result = byId('allTestsResult');
    result.classList.remove('hidden');
    result.innerHTML = '';
    logTest('allTestsResult', '🧪 Tüm testler başlıyor...');
    const results = [];
    try {
        const response = await fetch('/api/search?artist=test&type=artist', { credentials: 'same-origin' });
        results.push({ name: 'API Bağlantısı', ok: response.ok });
    } catch (_error) {
        results.push({ name: 'API Bağlantısı', ok: false });
    }
    try {
        const response = await fetch('/api/search?artist=test&type=track', { credentials: 'same-origin' });
        results.push({ name: 'Spotify API', ok: Array.isArray(await response.json()) });
    } catch (_error) {
        results.push({ name: 'Spotify API', ok: false });
    }
    try {
        const response = await adminFetch('/api/admin/stats');
        results.push({ name: 'Admin API', ok: response.ok });
    } catch (_error) {
        results.push({ name: 'Admin API', ok: false });
    }
    logTest('allTestsResult', '─────────────────────');
    results.forEach((entry) => logTest('allTestsResult', `${entry.ok ? '✅' : '❌'} ${entry.name}`, entry.ok ? 'ok' : 'error'));
    const passCount = results.filter((entry) => entry.ok).length;
    logTest('allTestsResult', '─────────────────────');
    logTest('allTestsResult', `Sonuç: ${passCount}/${results.length} test geçti`, passCount === results.length ? 'ok' : 'warn');
};

const updatePlayerIcon = (playing) => {
    byId('playerIcon').className = `fa-solid ${playing ? 'fa-pause' : 'fa-play'} text-black text-xl`;
};

const closePlayer = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    playingTrackId = null;
    byId('adminMiniPlayer').classList.remove('active');
};

const playPreview = (track) => {
    if (!track?.preview_url) {
        alert('Bu şarkı için preview URL yok');
        return;
    }
    const isCurrentTrack = currentAudio && playingTrackId === track.id;
    if (isCurrentTrack) {
        if (currentAudio.paused) {
            currentAudio.play();
            updatePlayerIcon(true);
        } else {
            currentAudio.pause();
            updatePlayerIcon(false);
        }
        return;
    }
    if (currentAudio) currentAudio.pause();
    currentAudio = new Audio(track.preview_url);
    currentAudio.volume = 0.5;
    playingTrackId = track.id;
    byId('playerImage').src = track.image || '/js/placeholder.svg';
    byId('playerTitle').textContent = track.name || 'Unknown';
    byId('playerArtist').textContent = track.artist || '';
    byId('adminMiniPlayer').classList.add('active');
    currentAudio.play().catch((error) => {
        alert(`Audio yüklenemedi: ${error.message}`);
        closePlayer();
    });
    updatePlayerIcon(true);
    currentAudio.ontimeupdate = () => {
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
        byId('playerProgress').style.width = `${progress}%`;
        byId('playerTime').textContent = `${formatTime(currentAudio.currentTime)} / ${formatTime(currentAudio.duration || 30)}`;
    };
    currentAudio.onended = () => {
        playingTrackId = null;
        updatePlayerIcon(false);
        byId('playerProgress').style.width = '0%';
    };
};

const formatTime = (seconds) => {
    if (Number.isNaN(Number(seconds))) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

const searchForPreview = async () => {
    const query = byId('previewSearchQuery').value;
    const result = byId('previewSearchResult');
    const list = byId('previewTrackList');
    result.textContent = 'Aranıyor...';
    list.innerHTML = '';
    try {
        const response = await fetch(`/api/search?artist=${encodeURIComponent(query)}&type=track`, { credentials: 'same-origin' });
        const data = await response.json();
        previewTracks = Array.isArray(data) ? data.filter((track) => track.preview_url).slice(0, 8) : [];
        result.innerHTML = `Bulunan: <span class="text-white">${Array.isArray(data) ? data.length : 0}</span> şarkı, <span class="text-green-400">${previewTracks.length}</span> preview var`;
        list.innerHTML = previewTracks.map((track, index) => `
            <div class="flex items-center gap-4 p-4 glass rounded-xl hover:bg-white/10 cursor-pointer transition"
                data-action="play-preview" data-track-index="${index}">
                <img src="${escapeHtml(track.image || '/js/placeholder.svg')}" class="w-12 h-12 rounded object-cover" alt="">
                <div class="flex-1 min-w-0">
                    <p class="font-bold truncate">${escapeHtml(track.name)}</p>
                    <p class="text-sm text-gray-400">${escapeHtml(track.artist)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">${Math.round((track.duration_ms || 30000) / 1000)}s</span>
                    <i class="fa-solid fa-play text-green-400 text-xl"></i>
                </div>
            </div>`).join('');
        if (!previewTracks.length) {
            list.innerHTML = '<p class="text-center text-gray-500 py-8">Bu arama için preview bulunamadı. Başka bir şarkı deneyin.</p>';
        }
    } catch (error) {
        result.innerHTML = `<span class="text-red-400">Hata: ${escapeHtml(error.message)}</span>`;
    }
};

const logout = async () => {
    try {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
        window.location.replace('/admin/login');
    }
};

document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    switch (control.dataset.action) {
    case 'refresh':
        Promise.all([loadStats(), loadUsers()]);
        break;
    case 'logout':
        logout();
        break;
    case 'switch-tab':
        switchTab(control.dataset.tab);
        break;
    case 'sort-users':
        currentSortOrder = currentSortBy === control.dataset.field && currentSortOrder === 'desc' ? 'asc' : 'desc';
        currentSortBy = control.dataset.field;
        updateSortIcons();
        loadUsers();
        break;
    case 'test-api':
        testAPI();
        break;
    case 'test-spotify':
        testSpotify();
        break;
    case 'test-search':
        testSearch();
        break;
    case 'run-tests':
        runAllTests();
        break;
    case 'open-home':
        window.open('/', '_blank');
        break;
    case 'search-preview':
        searchForPreview();
        break;
    case 'close-user-detail':
        byId('userDetailModal').classList.add('hidden');
        break;
    case 'view-user':
        viewUserDetail(control.dataset.userId);
        break;
    case 'delete-user':
        event.stopPropagation();
        deleteUser(control.dataset.userId, control.dataset.username);
        break;
    case 'play-preview':
        playPreview(previewTracks[Number(control.dataset.trackIndex)]);
        break;
    case 'toggle-player':
        if (!currentAudio) break;
        if (currentAudio.paused) {
            currentAudio.play();
            updatePlayerIcon(true);
        } else {
            currentAudio.pause();
            updatePlayerIcon(false);
        }
        break;
    case 'close-player':
        closePlayer();
        break;
    default:
        break;
    }
});

document.addEventListener('input', (event) => {
    if (event.target.dataset.action !== 'search-users') return;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearch = event.target.value;
        loadUsers();
    }, 300);
});

Promise.all([loadStats(), loadUsers()]);
