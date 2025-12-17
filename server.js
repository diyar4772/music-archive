const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 SECURITY: Strong JWT Secret with fallback warning
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    console.warn('⚠️ WARNING: Using default JWT_SECRET! Set a strong secret in .env for production!');
    return 'super_secret_music_key_CHANGE_ME_IN_PRODUCTION_' + Date.now();
})();

// 🔒 SECURITY: Admin credentials (change in production!)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 🔒 SECURITY: Trust proxy for Render.com (required for rate limiting behind proxy)
app.set('trust proxy', 1);

// 🔒 SECURITY: Helmet for secure HTTP headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for CDN scripts
    crossOriginEmbedderPolicy: false
}));

// 🔒 SECURITY: Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests. Please slow down.' }
});

app.use(cors());
app.use(express.static('.'));
app.use(express.json({ limit: '5mb' })); // Limit payload size
app.use(generalLimiter);

// --- In-Memory Fallback Database ---
let useInMemory = false;
const inMemoryDB = {
    users: [],
    follows: [],
    albumFollows: [],
    likes: [],
    playlists: [],
    playlistTracks: [],
    nextId: 1
};

const generateId = () => {
    return 'local_' + (inMemoryDB.nextId++).toString() + '_' + Date.now();
};

// --- MongoDB Connection ---
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('✅ MongoDB Connected!'))
        .catch(err => {
            console.error('❌ MongoDB Connection Error:', err.message);
            console.log('🔄 Switching to In-Memory Database for local testing...');
            useInMemory = true;
        });
} else {
    console.log('⚠️ MONGO_URI not set - Using In-Memory Database for local testing');
    useInMemory = true;
}

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, minlength: 3, maxlength: 30 },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0 }
}, { timestamps: true });

const followSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    artistId: { type: String, required: true },
    artistName: { type: String },
    image: { type: String }
}, { timestamps: true });

const albumFollowSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    albumId: { type: String, required: true },
    albumName: { type: String },
    image: { type: String },
    artistName: { type: String }
}, { timestamps: true });

const likeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trackId: { type: String, required: true },
    trackName: { type: String },
    image: { type: String },
    previewUrl: { type: String }
}, { timestamps: true });

const playlistSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    coverImage: { type: String, default: null } // Custom cover image URL
}, { timestamps: true });

const playlistTrackSchema = new mongoose.Schema({
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
    trackId: { type: String, required: true },
    trackName: { type: String },
    image: { type: String },
    previewUrl: { type: String }
}, { timestamps: true });

// --- Mongoose Models ---
const User = mongoose.model('User', userSchema);
const Follow = mongoose.model('Follow', followSchema);
const AlbumFollow = mongoose.model('AlbumFollow', albumFollowSchema);
const Like = mongoose.model('Like', likeSchema);
const Playlist = mongoose.model('Playlist', playlistSchema);
const PlaylistTrack = mongoose.model('PlaylistTrack', playlistTrackSchema);

// --- Spotify Token Management ---
let spotifyToken = null;
let tokenExpiration = 0;

const getSpotifyToken = async () => {
    if (spotifyToken && Date.now() < tokenExpiration) return spotifyToken;
    try {
        const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
        const resp = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        spotifyToken = resp.data.access_token;
        tokenExpiration = Date.now() + (resp.data.expires_in * 1000) - 60000;
        return spotifyToken;
    } catch (e) {
        console.error('Spotify Auth Error:', e.message);
        throw new Error('Failed to get Spotify Token');
    }
};

// --- Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Input Validation Helpers ---
const validateUsername = body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
    .escape();

const validatePassword = body('password')
    .isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters');

// --- Routes: Auth ---
app.post('/api/register', authLimiter, [validateUsername, validatePassword], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 12); // Increased from 10 to 12

        if (useInMemory) {
            // In-memory registration
            if (inMemoryDB.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
                return res.status(400).json({ error: 'Username already taken' });
            }
            const userId = generateId();
            inMemoryDB.users.push({ _id: userId, username, password: hashedPassword, createdAt: new Date(), isAdmin: false });
            const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, username });
        }

        // Check if username exists (case-insensitive)
        const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const user = await User.create({ username, password: hashedPassword });
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username });
    } catch (e) {
        console.error('Registration error:', e.message);
        res.status(400).json({ error: 'Registration failed. Please try again.' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (useInMemory) {
            // In-memory login
            const user = inMemoryDB.users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            user.lastLogin = new Date();
            user.loginCount = (user.loginCount || 0) + 1;
            const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, username: user.username });
        }

        const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update login stats
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username });
    } catch (e) {
        console.error('Login error:', e.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// --- Routes: Data (Public) ---

// Search
app.get('/api/search', async (req, res) => {
    try {
        const { artist, type } = req.query;
        if (!artist) return res.status(400).json({ error: 'Missing query' });

        const token = await getSpotifyToken();

        // Determine search type based on request
        let spotifyType = 'artist';
        let searchLimit = 5;

        if (type === 'track') {
            spotifyType = 'track';
            searchLimit = 10;
        } else if (type === 'album') {
            spotifyType = 'album';
            searchLimit = 10;
        }

        const searchResp = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=${spotifyType}&limit=${searchLimit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (type === 'simple') {
            const artistData = searchResp.data.artists.items[0];
            if (!artistData) return res.status(404).json({ error: 'Artist not found' });

            // Fetch ALL albums using pagination
            let allAlbums = [];
            let offset = 0;
            const limit = 50; // Max allowed by Spotify
            let hasMore = true;

            while (hasMore) {
                const albumsResp = await axios.get(
                    `https://api.spotify.com/v1/artists/${artistData.id}/albums?include_groups=album,single&limit=${limit}&offset=${offset}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                const items = albumsResp.data.items;
                allAlbums = allAlbums.concat(items);

                // Check if there are more albums
                if (items.length < limit || allAlbums.length >= albumsResp.data.total) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            }

            // Remove duplicates by album name (Spotify sometimes returns same album in different versions)
            const uniqueAlbums = [];
            const seenNames = new Set();
            for (const album of allAlbums) {
                const normalizedName = album.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
                if (!seenNames.has(normalizedName)) {
                    seenNames.add(normalizedName);
                    uniqueAlbums.push(album);
                }
            }

            return res.json({
                id: artistData.id,
                name: artistData.name,
                image: artistData.images[0]?.url,
                totalAlbums: uniqueAlbums.length,
                albums: uniqueAlbums.map(a => ({
                    id: a.id,
                    name: a.name,
                    image: a.images[0]?.url,
                    year: a.release_date?.split('-')[0] || ''
                }))
            });
        }

        // Album search results
        if (type === 'album') {
            return res.json(searchResp.data.albums.items.map(a => ({
                id: a.id,
                name: a.name,
                artist: a.artists[0]?.name || 'Unknown',
                image: a.images[0]?.url,
                year: a.release_date?.split('-')[0] || '',
                totalTracks: a.total_tracks
            })));
        }

        // Track search results
        if (type === 'track') {
            return res.json(searchResp.data.tracks.items.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artists[0].name,
                image: t.album.images[0]?.url,
                preview_url: t.preview_url,
                duration_ms: t.duration_ms
            })));
        }

        // Artist search results (default)
        res.json(searchResp.data.artists.items.map(a => ({
            id: a.id,
            name: a.name,
            image: a.images[0]?.url || null,
            genres: a.genres.slice(0, 2).join(', ')
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Album Details
app.get('/api/album/:id', async (req, res) => {
    try {
        const token = await getSpotifyToken();
        const resp = await axios.get(`https://api.spotify.com/v1/albums/${req.params.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json({
            id: resp.data.id,
            name: resp.data.name,
            image: resp.data.images[0]?.url,
            artist: resp.data.artists[0].name,
            tracks: resp.data.tracks.items.map(t => ({
                id: t.id,
                name: t.name,
                duration_ms: t.duration_ms,
                preview_url: t.preview_url,
                spotify_url: t.external_urls.spotify
            }))
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch album' });
    }
});

// --- Routes: User Data (Protected) ---

// Get User Data
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        if (useInMemory) {
            const follows = inMemoryDB.follows.filter(f => f.userId === req.user.id);
            const likes = inMemoryDB.likes.filter(l => l.userId === req.user.id);
            const albumFollows = inMemoryDB.albumFollows.filter(a => a.userId === req.user.id);
            return res.json({
                follows: follows.map(f => ({ artistId: f.artistId, artistName: f.artistName, image: f.image })),
                likes: likes.map(l => ({ trackId: l.trackId, trackName: l.trackName, image: l.image, previewUrl: l.previewUrl })),
                albumFollows: albumFollows.map(a => ({ albumId: a.albumId, albumName: a.albumName, image: a.image, artistName: a.artistName }))
            });
        }

        const follows = await Follow.find({ userId: req.user.id });
        const likes = await Like.find({ userId: req.user.id });
        const albumFollows = await AlbumFollow.find({ userId: req.user.id });

        res.json({
            follows: follows.map(f => ({ artistId: f.artistId, artistName: f.artistName, image: f.image })),
            likes: likes.map(l => ({ trackId: l.trackId, trackName: l.trackName, image: l.image, previewUrl: l.previewUrl })),
            albumFollows: albumFollows.map(a => ({ albumId: a.albumId, albumName: a.albumName, image: a.image, artistName: a.artistName }))
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Follow Artist
app.post('/api/follow', authenticateToken, async (req, res) => {
    try {
        const { artistId, artistName, image } = req.body;

        if (useInMemory) {
            const existsIdx = inMemoryDB.follows.findIndex(f => f.userId === req.user.id && f.artistId === artistId);
            if (existsIdx !== -1) {
                inMemoryDB.follows.splice(existsIdx, 1);
                return res.json({ status: 'unfollowed' });
            }
            inMemoryDB.follows.push({ _id: generateId(), userId: req.user.id, artistId, artistName, image });
            return res.json({ status: 'followed' });
        }

        const exists = await Follow.findOne({ userId: req.user.id, artistId });
        if (exists) {
            await Follow.deleteOne({ _id: exists._id });
            return res.json({ status: 'unfollowed' });
        }
        await Follow.create({ userId: req.user.id, artistId, artistName, image });
        res.json({ status: 'followed' });
    } catch (e) {
        res.status(500).json({ error: 'Action failed' });
    }
});

// Like Track
app.post('/api/like', authenticateToken, async (req, res) => {
    try {
        const { trackId, trackName, image, previewUrl } = req.body;

        if (useInMemory) {
            const existsIdx = inMemoryDB.likes.findIndex(l => l.userId === req.user.id && l.trackId === trackId);
            if (existsIdx !== -1) {
                inMemoryDB.likes.splice(existsIdx, 1);
                return res.json({ status: 'unliked' });
            }
            inMemoryDB.likes.push({ _id: generateId(), userId: req.user.id, trackId, trackName, image, previewUrl });
            return res.json({ status: 'liked' });
        }

        const exists = await Like.findOne({ userId: req.user.id, trackId });
        if (exists) {
            await Like.deleteOne({ _id: exists._id });
            return res.json({ status: 'unliked' });
        }
        await Like.create({ userId: req.user.id, trackId, trackName, image, previewUrl });
        res.json({ status: 'liked' });
    } catch (e) {
        res.status(500).json({ error: 'Action failed' });
    }
});

// Follow Album
app.post('/api/follow-album', authenticateToken, async (req, res) => {
    try {
        const { albumId, albumName, image, artistName } = req.body;

        if (useInMemory) {
            const existsIdx = inMemoryDB.albumFollows.findIndex(a => a.userId === req.user.id && a.albumId === albumId);
            if (existsIdx !== -1) {
                inMemoryDB.albumFollows.splice(existsIdx, 1);
                return res.json({ status: 'unfollowed' });
            }
            inMemoryDB.albumFollows.push({ _id: generateId(), userId: req.user.id, albumId, albumName, image, artistName });
            return res.json({ status: 'followed' });
        }

        const existing = await AlbumFollow.findOne({ userId: req.user.id, albumId });
        if (existing) {
            await AlbumFollow.deleteOne({ _id: existing._id });
            return res.json({ status: 'unfollowed' });
        }
        await AlbumFollow.create({ userId: req.user.id, albumId, albumName, image, artistName });
        res.json({ status: 'followed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Playlist Routes ---
app.get('/api/playlists', authenticateToken, async (req, res) => {
    try {
        if (useInMemory) {
            const playlists = inMemoryDB.playlists.filter(p => p.userId === req.user.id);
            const result = playlists.map(pl => {
                const tracks = inMemoryDB.playlistTracks.filter(t => t.playlistId === pl._id);
                return {
                    id: pl._id,
                    name: pl.name,
                    coverImage: pl.coverImage || null,
                    PlaylistTracks: tracks
                };
            });
            return res.json(result);
        }

        const playlists = await Playlist.find({ userId: req.user.id });
        const result = await Promise.all(playlists.map(async (pl) => {
            const tracks = await PlaylistTrack.find({ playlistId: pl._id });
            return {
                id: pl._id,
                name: pl.name,
                coverImage: pl.coverImage || null,
                PlaylistTracks: tracks
            };
        }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

app.post('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;

        if (useInMemory) {
            const playlistId = generateId();
            inMemoryDB.playlists.push({ _id: playlistId, userId: req.user.id, name });
            return res.json({ id: playlistId, name });
        }

        const playlist = await Playlist.create({ userId: req.user.id, name });
        res.json({ id: playlist._id, name: playlist.name });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

app.post('/api/playlists/:id/add', authenticateToken, async (req, res) => {
    try {
        const { trackId, trackName, image, previewUrl } = req.body;

        if (useInMemory) {
            const playlist = inMemoryDB.playlists.find(p => p._id === req.params.id && p.userId === req.user.id);
            if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

            inMemoryDB.playlistTracks.push({
                _id: generateId(),
                playlistId: playlist._id,
                trackId, trackName, image, previewUrl
            });
            return res.json({ status: 'added' });
        }

        const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.user.id });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        await PlaylistTrack.create({
            playlistId: playlist._id, trackId, trackName, image, previewUrl
        });
        res.json({ status: 'added' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add track' });
    }
});

// Delete Playlist
app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
    try {
        // Decode the playlist ID in case it was URL encoded
        const decodedId = decodeURIComponent(req.params.id);
        console.log('Delete playlist request for ID:', decodedId);

        if (useInMemory) {
            const playlistIdx = inMemoryDB.playlists.findIndex(p => p._id === decodedId && p.userId === req.user.id);
            console.log('Found playlist at index:', playlistIdx);
            if (playlistIdx === -1) return res.status(404).json({ error: 'Playlist not found' });

            const playlistId = inMemoryDB.playlists[playlistIdx]._id;
            inMemoryDB.playlistTracks = inMemoryDB.playlistTracks.filter(t => t.playlistId !== playlistId);
            inMemoryDB.playlists.splice(playlistIdx, 1);
            console.log('Playlist deleted successfully');
            return res.json({ status: 'deleted' });
        }

        const playlist = await Playlist.findOne({ _id: decodedId, userId: req.user.id });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        await PlaylistTrack.deleteMany({ playlistId: playlist._id });
        await Playlist.deleteOne({ _id: playlist._id });
        res.json({ status: 'deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

// Remove Track from Playlist
app.delete('/api/playlists/:id/tracks/:trackId', authenticateToken, async (req, res) => {
    try {
        // Decode the trackId in case it was URL encoded
        const decodedTrackId = decodeURIComponent(req.params.trackId);

        if (useInMemory) {
            const trackIdx = inMemoryDB.playlistTracks.findIndex(
                t => t.playlistId === req.params.id && t.trackId === decodedTrackId
            );
            if (trackIdx === -1) return res.status(404).json({ error: 'Track not found' });

            inMemoryDB.playlistTracks.splice(trackIdx, 1);
            return res.json({ status: 'removed' });
        }

        const result = await PlaylistTrack.deleteOne({
            playlistId: req.params.id,
            trackId: decodedTrackId
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Track not found' });
        res.json({ status: 'removed' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove track' });
    }
});

// Update Playlist Cover Image
app.put('/api/playlists/:id/cover', authenticateToken, async (req, res) => {
    try {
        const { coverImage } = req.body;
        const decodedId = decodeURIComponent(req.params.id);

        if (useInMemory) {
            const playlist = inMemoryDB.playlists.find(p => p._id === decodedId && p.userId === req.user.id);
            if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

            playlist.coverImage = coverImage;
            return res.json({ status: 'updated', coverImage });
        }

        const playlist = await Playlist.findOne({ _id: decodedId, userId: req.user.id });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        playlist.coverImage = coverImage;
        await playlist.save();
        res.json({ status: 'updated', coverImage });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update cover' });
    }
});

// ============================================
// 🔒 ADMIN ROUTES - User Management
// ============================================

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Check for Basic Auth (admin:password)
    if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            return next();
        }
    }

    // Check for JWT with admin flag
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.isAdmin) {
                req.user = decoded;
                return next();
            }
        } catch (e) { }
    }

    res.status(403).json({ error: 'Admin access required' });
};

// 📊 Get all users with stats
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        if (useInMemory) {
            const users = inMemoryDB.users.map(u => ({
                id: u._id,
                username: u.username,
                createdAt: u.createdAt,
                lastLogin: u.lastLogin,
                loginCount: u.loginCount || 0,
                isAdmin: u.isAdmin || false,
                likesCount: inMemoryDB.likes.filter(l => l.userId === u._id).length,
                followsCount: inMemoryDB.follows.filter(f => f.userId === u._id).length,
                playlistsCount: inMemoryDB.playlists.filter(p => p.userId === u._id).length
            }));
            return res.json({ total: users.length, users });
        }

        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        const userStats = await Promise.all(users.map(async (user) => {
            const [likesCount, followsCount, albumFollowsCount, playlistsCount] = await Promise.all([
                Like.countDocuments({ userId: user._id }),
                Follow.countDocuments({ userId: user._id }),
                AlbumFollow.countDocuments({ userId: user._id }),
                Playlist.countDocuments({ userId: user._id })
            ]);
            return {
                id: user._id,
                username: user.username,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                loginCount: user.loginCount || 0,
                isAdmin: user.isAdmin || false,
                likesCount,
                followsCount,
                albumFollowsCount,
                playlistsCount
            };
        }));

        res.json({ total: userStats.length, users: userStats });
    } catch (e) {
        console.error('Admin users error:', e.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// 📊 Get specific user's activity
app.get('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (useInMemory) {
            const user = inMemoryDB.users.find(u => u._id === userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            return res.json({
                user: { id: user._id, username: user.username, createdAt: user.createdAt, lastLogin: user.lastLogin },
                likes: inMemoryDB.likes.filter(l => l.userId === userId),
                follows: inMemoryDB.follows.filter(f => f.userId === userId),
                playlists: inMemoryDB.playlists.filter(p => p.userId === userId).map(p => ({
                    ...p,
                    tracks: inMemoryDB.playlistTracks.filter(t => t.playlistId === p._id)
                }))
            });
        }

        const user = await User.findById(userId, '-password');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const [likes, follows, albumFollows, playlists] = await Promise.all([
            Like.find({ userId }),
            Follow.find({ userId }),
            AlbumFollow.find({ userId }),
            Playlist.find({ userId })
        ]);

        const playlistsWithTracks = await Promise.all(playlists.map(async (pl) => {
            const tracks = await PlaylistTrack.find({ playlistId: pl._id });
            return { ...pl.toObject(), tracks };
        }));

        res.json({
            user: {
                id: user._id,
                username: user.username,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                loginCount: user.loginCount
            },
            likes,
            follows,
            albumFollows,
            playlists: playlistsWithTracks
        });
    } catch (e) {
        console.error('Admin user detail error:', e.message);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// 📊 Get system stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        if (useInMemory) {
            return res.json({
                totalUsers: inMemoryDB.users.length,
                totalLikes: inMemoryDB.likes.length,
                totalFollows: inMemoryDB.follows.length,
                totalPlaylists: inMemoryDB.playlists.length,
                totalPlaylistTracks: inMemoryDB.playlistTracks.length,
                recentUsers: inMemoryDB.users.slice(-5).reverse()
            });
        }

        const [totalUsers, totalLikes, totalFollows, totalAlbumFollows, totalPlaylists] = await Promise.all([
            User.countDocuments(),
            Like.countDocuments(),
            Follow.countDocuments(),
            AlbumFollow.countDocuments(),
            Playlist.countDocuments()
        ]);

        const recentUsers = await User.find({}, 'username createdAt lastLogin').sort({ createdAt: -1 }).limit(5);

        res.json({
            totalUsers,
            totalLikes,
            totalFollows,
            totalAlbumFollows,
            totalPlaylists,
            recentUsers
        });
    } catch (e) {
        console.error('Admin stats error:', e.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// 🗑️ Delete user (admin only)
app.delete('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (useInMemory) {
            const userIdx = inMemoryDB.users.findIndex(u => u._id === userId);
            if (userIdx === -1) return res.status(404).json({ error: 'User not found' });

            // Delete all user data
            inMemoryDB.users.splice(userIdx, 1);
            inMemoryDB.likes = inMemoryDB.likes.filter(l => l.userId !== userId);
            inMemoryDB.follows = inMemoryDB.follows.filter(f => f.userId !== userId);
            inMemoryDB.albumFollows = inMemoryDB.albumFollows.filter(a => a.userId !== userId);
            const userPlaylists = inMemoryDB.playlists.filter(p => p.userId === userId);
            userPlaylists.forEach(p => {
                inMemoryDB.playlistTracks = inMemoryDB.playlistTracks.filter(t => t.playlistId !== p._id);
            });
            inMemoryDB.playlists = inMemoryDB.playlists.filter(p => p.userId !== userId);

            return res.json({ status: 'deleted' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Delete all user data
        await Promise.all([
            Like.deleteMany({ userId }),
            Follow.deleteMany({ userId }),
            AlbumFollow.deleteMany({ userId }),
            PlaylistTrack.deleteMany({ playlistId: { $in: await Playlist.find({ userId }).distinct('_id') } }),
            Playlist.deleteMany({ userId }),
            User.findByIdAndDelete(userId)
        ]);

        res.json({ status: 'deleted', username: user.username });
    } catch (e) {
        console.error('Admin delete user error:', e.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔒 Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`📊 Admin API: /api/admin/users, /api/admin/stats`);
});
