export function mountShell() {
    document.body.insertAdjacentHTML('beforeend', `
    <!-- Settings Modal -->
    <div id="settingsModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/80 z-[70] flex items-center justify-center p-4">
        <div
            class="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl p-6 relative shadow-xl border border-gray-200 dark:border-white/5">
            <button onclick="closeSettingsModal()"
                class="absolute top-4 right-4 text-gray-400 hover:text-text-light dark:hover:text-white transition-colors">
                <i class="fa-solid fa-times text-xl"></i>
            </button>
            <h2 class="text-2xl font-bold mb-6" data-lang="settings">Ayarlar</h2>

            <div class="space-y-6">
                <!-- Theme -->
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-bold" data-lang="theme">Tema</h3>
                        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark"
                            data-lang="theme_desc">Koyu/Açık mod değiştir</p>
                    </div>
                    <button onclick="toggleTheme()"
                        class="bg-gray-100 dark:bg-[#333] p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#444] transition-colors">
                        <i id="themeIcon" class="fa-solid fa-moon text-yellow-400 dark:text-yellow-400 text-xl"></i>
                    </button>
                </div>

                <!-- Language -->
                <div>
                    <h3 class="font-bold mb-2" data-lang="settings.language">Dil</h3>
                    <select id="languageSelect" onchange="changeLanguage(this.value)"
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
                        id="modalType">Album</p>
                    <h2 id="modalTitle" class="text-3xl font-bold truncate"></h2>
                </div>
                <button onclick="closeDetailsModal()"
                    class="text-gray-400 hover:text-text-light dark:hover:text-white transition-colors"><i
                        class="fa-solid fa-xmark fa-xl"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto p-4" id="modalTracks"></div>
        </div>
    </div>

    <!-- Add to Playlist Modal -->
    <div id="addToPlaylistModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 flex justify-center items-center z-[80]"
        onclick="this.classList.add('hidden'); this.classList.remove('visible');">
        <div class="bg-white dark:bg-card-dark p-6 rounded-lg w-full max-w-sm border border-gray-200 dark:border-white/5 shadow-xl"
            onclick="event.stopPropagation();">
            <h3 class="text-xl font-bold mb-4">Listeye Ekle</h3>
            <div id="playlistOptions" class="space-y-2 max-h-60 overflow-y-auto mb-4"></div>
            <button
                onclick="document.getElementById('addToPlaylistModal').classList.add('hidden'); document.getElementById('addToPlaylistModal').classList.remove('visible');"
                class="w-full py-2 bg-gray-100 dark:bg-[#2a2a34] rounded-lg text-text-secondary-light dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">İptal</button>
        </div>
    </div>

    <!-- Create Playlist Modal -->
    <div id="createPlaylistModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 z-[85] flex items-center justify-center p-4"
        onclick="closeCreatePlaylistModal()">
        <div class="bg-white dark:bg-gradient-to-b dark:from-gray-800 dark:to-card-dark p-8 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700"
            onclick="event.stopPropagation();">
            <div class="text-center mb-6">
                <div
                    class="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-music text-2xl text-white"></i>
                </div>
                <h3 class="text-2xl font-bold">Yeni Liste Oluştur</h3>
                <p class="text-text-secondary-light dark:text-gray-400 text-sm mt-1">Şarkılarını organize et</p>
            </div>
            <input type="text" id="newPlaylistName" placeholder="Liste adı..."
                class="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 rounded-xl mb-6 text-text-light dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                onkeypress="if(event.key==='Enter') confirmCreatePlaylist()">
            <div class="flex gap-3">
                <button onclick="confirmCreatePlaylist()"
                    class="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-bold py-3 rounded-full transition transform hover:scale-105">
                    <i class="fa-solid fa-plus mr-2"></i>Oluştur
                </button>
                <button onclick="closeCreatePlaylistModal()"
                    class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-white py-3 rounded-full transition-colors">
                    İptal
                </button>
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
                    <i class="fa-solid fa-check mr-2"></i>Evet, Sil
                </button>
                <button onclick="closeConfirmModal()"
                    class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-white py-3 rounded-full transition-colors">
                    İptal
                </button>
            </div>
        </div>
    </div>

    <!-- Change Cover Modal -->
    <div id="changeCoverModal"
        class="modal hidden fixed inset-0 bg-black/50 dark:bg-black/90 z-[110] flex items-center justify-center p-4"
        onclick="closeChangeCoverModal()">
        <div class="bg-white dark:bg-gradient-to-b dark:from-gray-800 dark:to-card-dark p-6 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-in"
            onclick="event.stopPropagation()">
            <div class="text-center mb-4">
                <div
                    class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-image text-2xl text-white"></i>
                </div>
                <h3 class="text-xl font-bold">Change Cover</h3>
                <p class="text-text-secondary-light dark:text-gray-400 text-sm mt-1">Upload an image or enter a URL</p>
            </div>

            <!-- Tab Selection -->
            <div class="flex gap-2 mb-4">
                <button onclick="setCoverTab('upload')" id="coverTabUpload"
                    class="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-blue-500 text-white transition-colors">
                    <i class="fa-solid fa-upload mr-2"></i>Upload
                </button>
                <button onclick="setCoverTab('url')" id="coverTabUrl"
                    class="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-text-secondary-light dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <i class="fa-solid fa-link mr-2"></i>URL
                </button>
            </div>

            <!-- Upload Section -->
            <div id="coverUploadSection" class="mb-4">
                <label
                    class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div class="flex flex-col items-center justify-center pt-5 pb-6">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2"></i>
                        <p class="text-sm text-text-secondary-light dark:text-gray-400">Click to upload or drag & drop
                        </p>
                        <p class="text-xs text-gray-500">PNG, JPG, WEBP (Max 2MB)</p>
                    </div>
                    <input type="file" id="coverFileInput" accept="image/*" class="hidden"
                        onchange="handleCoverFileSelect(event)">
                </label>
            </div>

            <!-- URL Section -->
            <div id="coverUrlSection" class="mb-4 hidden">
                <input type="text" id="coverUrlInput" placeholder="https://example.com/image.jpg"
                    class="w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-lg text-text-light dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors">
            </div>

            <!-- Preview -->
            <div id="coverPreviewContainer" class="mb-4 hidden">
                <p class="text-sm text-text-secondary-light dark:text-gray-400 mb-2">Preview:</p>
                <img id="coverPreviewImg" src=""
                    class="w-24 h-24 object-cover rounded-lg mx-auto border-2 border-gray-200 dark:border-gray-600">
            </div>

            <div class="flex gap-3">
                <button onclick="confirmCoverChange()"
                    class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-3 rounded-full transition transform hover:scale-105">
                    <i class="fa-solid fa-check mr-2"></i>Save
                </button>
                <button onclick="closeChangeCoverModal()"
                    class="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-text-light dark:text-white py-3 rounded-full transition-colors">
                    Cancel
                </button>
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
                <h3 class="font-bold text-lg">Şarkı Detayları</h3>
                <button onclick="closeTrackDetail()"
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
                    <p class="text-sm text-text-secondary-light dark:text-gray-400 mb-2">Puanla</p>
                    <div id="trackDetailRating" class="flex justify-center gap-2"></div>
                    <p id="trackDetailRatingText" class="text-center text-sm text-gray-500 mt-2"></p>
                </div>

                <!-- Preview Button -->
                <button id="trackDetailPlayBtn" onclick="playTrackFromDetail()"
                    class="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl mb-4 flex items-center justify-center gap-3 hover:opacity-90 transition">
                    <i class="fa-solid fa-play"></i>
                    <span data-lang="track.preview">30sn Önizle</span>
                </button>

                <!-- Streaming Links -->
                <p class="text-sm text-text-secondary-light dark:text-gray-400 mb-3">Dinle</p>
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
                            Kişisel Not
                        </p>
                        <button id="trackNoteSaveBtn" onclick="saveTrackNote()"
                            class="text-xs text-green-500 hover:text-green-400 hidden">
                            <i class="fa-solid fa-check mr-1"></i>Kaydet
                        </button>
                    </div>
                    <textarea id="trackDetailNote"
                        placeholder="Bu şarkı için kişisel not ekle... (örn: 'Yaz konseri hatırası', 'Annem'in favorisi')"
                        class="w-full bg-white dark:bg-transparent border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-text-light dark:text-white text-sm resize-none focus:outline-none focus:border-green-500 transition-colors"
                        rows="2" oninput="showNoteSaveBtn()"></textarea>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                    <button id="trackDetailLikeBtn" onclick="toggleLikeFromDetail()"
                        class="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i id="trackDetailLikeIcon" class="fa-regular fa-heart"></i>
                        <span id="trackDetailLikeText">Beğen</span>
                    </button>
                    <button id="trackDetailAddBtn" onclick="addToPlaylistFromDetail()"
                        class="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i class="fa-solid fa-plus"></i>
                        <span>Listeye Ekle</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Mini Player -->
    <div id="miniPlayer"
        class="mini-player bg-white dark:bg-gradient-to-r dark:from-[#282828] dark:to-[#181818] border-t border-gray-200 dark:border-[#333]">
        <div class="mini-player-progress" onclick="seekTrack(event)">
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
                <button id="miniPlayerCloseBtn"
                    class="text-gray-400 hover:text-text-light dark:hover:text-white p-2 transition-colors">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
        </div>
    </div>


`);
}
