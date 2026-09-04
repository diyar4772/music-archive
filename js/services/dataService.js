/**
 * Data Service Module
 * Handles all data operations for the music archive
 * Supports both static JSON and localStorage for user-added artists
 */

const DATA_STORAGE_KEY = 'musicArchive_customArtists';

/**
 * Fetches all artists from the JSON file
 * @returns {Promise<Array>} Array of artist objects
 */
export async function getBaseArtists() {
    try {
        const response = await fetch('./js/data/artists.json');
        if (!response.ok) {
            throw new Error('Failed to load artists data');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading base artists:', error);
        return [];
    }
}

/**
 * Gets custom artists from localStorage
 * @returns {Array} Array of custom artist objects
 */
export function getCustomArtists() {
    try {
        const stored = localStorage.getItem(DATA_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading custom artists:', error);
        return [];
    }
}

/**
 * Saves custom artists to localStorage
 * @param {Array} artists - Array of artist objects
 */
function saveCustomArtists(artists) {
    try {
        localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(artists));
    } catch (error) {
        console.error('Error saving custom artists:', error);
    }
}

/**
 * Gets all artists (base + custom)
 * @returns {Promise<Array>} Combined array of all artists
 */
export async function getAllArtists() {
    const baseArtists = await getBaseArtists();
    const customArtists = getCustomArtists();
    return [...baseArtists, ...customArtists];
}

/**
 * Gets a single artist by ID
 * @param {string} id - Artist ID
 * @returns {Promise<Object|null>} Artist object or null
 */
export async function getArtistById(id) {
    const allArtists = await getAllArtists();
    return allArtists.find(artist => artist.id === id) || null;
}

/**
 * Adds a new custom artist
 * @param {Object} artistData - Artist data object
 * @returns {Object} The created artist with generated ID
 */
export function addArtist(artistData) {
    const customArtists = getCustomArtists();
    
    // Generate unique ID from name
    const id = artistData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();
    
    const newArtist = {
        id,
        name: artistData.name,
        genre: artistData.genre || 'Bilinmiyor',
        image: artistData.image || null,
        bio: artistData.bio || '',
        albums: artistData.albums || [],
        links: {
            wikipedia: artistData.wikipedia || null,
            spotify: artistData.spotify || null,
            youtube: artistData.youtube || null,
            appleMusic: artistData.appleMusic || null
        },
        isCustom: true,
        createdAt: new Date().toISOString()
    };
    
    customArtists.push(newArtist);
    saveCustomArtists(customArtists);
    
    return newArtist;
}

/**
 * Removes a custom artist by ID
 * @param {string} id - Artist ID to remove
 * @returns {boolean} Success status
 */
export function removeArtist(id) {
    const customArtists = getCustomArtists();
    const index = customArtists.findIndex(artist => artist.id === id);
    
    if (index !== -1) {
        customArtists.splice(index, 1);
        saveCustomArtists(customArtists);
        return true;
    }
    
    return false;
}

/**
 * Updates an existing custom artist
 * @param {string} id - Artist ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated artist or null
 */
export function updateArtist(id, updates) {
    const customArtists = getCustomArtists();
    const index = customArtists.findIndex(artist => artist.id === id);
    
    if (index !== -1) {
        customArtists[index] = { ...customArtists[index], ...updates };
        saveCustomArtists(customArtists);
        return customArtists[index];
    }
    
    return null;
}

/**
 * Clears all custom artists
 */
export function clearCustomArtists() {
    localStorage.removeItem(DATA_STORAGE_KEY);
}

/**
 * Exports all artists as JSON
 * @returns {Promise<string>} JSON string of all artists
 */
export async function exportArtists() {
    const allArtists = await getAllArtists();
    return JSON.stringify(allArtists, null, 2);
}
