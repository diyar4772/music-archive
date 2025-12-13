const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_music_key';

app.use(cors());
app.use(express.static('.'));
app.use(express.json());

// --- Database Setup (SQLite + Sequelize) ---
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    logging: false // Disable console logging for SQL queries
});

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false }
});

const Follow = sequelize.define('Follow', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    artistId: { type: DataTypes.STRING, allowNull: false },
    artistName: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING } // New: Store artist image
});

const AlbumFollow = sequelize.define('AlbumFollow', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    albumId: { type: DataTypes.STRING, allowNull: false },
    albumName: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING },
    artistName: { type: DataTypes.STRING }
});

const Like = sequelize.define('Like', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    trackId: { type: DataTypes.STRING, allowNull: false },
    trackName: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING }, // New: Store album art
    previewUrl: { type: DataTypes.STRING } // New: Store preview audio
});

const Playlist = sequelize.define('Playlist', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }
});

const PlaylistTrack = sequelize.define('PlaylistTrack', {
    playlistId: { type: DataTypes.INTEGER, allowNull: false },
    trackId: { type: DataTypes.STRING, allowNull: false },
    trackName: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING },
    previewUrl: { type: DataTypes.STRING }
});

// Relationships
User.hasMany(Follow, { foreignKey: 'userId' });
User.hasMany(AlbumFollow, { foreignKey: 'userId' });
User.hasMany(Like, { foreignKey: 'userId' });
User.hasMany(Playlist, { foreignKey: 'userId' });
Playlist.hasMany(PlaylistTrack, { foreignKey: 'playlistId' });

// Sync Database
// Sync Database
sequelize.sync({ force: false }).then(() => console.log('Database & Tables synced!'));

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
    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
};

// --- Routes: Auth ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, username });
    } catch (e) {
        res.status(400).json({ error: 'Username likely taken' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, username });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// --- Routes: Data (Public + Protected) ---

// Search (Public) - Updated for Tracks
app.get('/api/search', async (req, res) => {
    try {
        const { artist, type } = req.query;
        if (!artist) return res.status(400).json({ error: 'Missing query' });

        const token = await getSpotifyToken();

        // Autocomplete or Track Search
        const searchType = type === 'track' ? 'track' : 'artist';
        const searchLimit = type === 'track' ? 10 : 5;

        const searchResp = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=${searchType}&limit=${searchLimit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (type === 'simple') {
            // ... existing simple logic (unchanged fallback) ...
            const artistData = searchResp.data.artists.items[0];
            if (!artistData) return res.status(404).json({ error: 'Artist not found' });
            const albumsResp = await axios.get(`https://api.spotify.com/v1/artists/${artistData.id}/albums?include_groups=album,single&limit=20`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.json({
                id: artistData.id,
                name: artistData.name,
                image: artistData.images[0]?.url,
                albums: albumsResp.data.items.map(a => ({
                    id: a.id,
                    name: a.name,
                    image: a.images[0]?.url,
                    year: a.release_date.split('-')[0]
                }))
            });
        }

        if (searchType === 'track') {
            res.json(searchResp.data.tracks.items.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artists[0].name,
                image: t.album.images[0]?.url,
                preview_url: t.preview_url,
                duration_ms: t.duration_ms
            })));
        } else {
            // Artist Autocomplete
            res.json(searchResp.data.artists.items.map(a => ({
                id: a.id,
                name: a.name,
                image: a.images[0]?.url || null,
                genres: a.genres.slice(0, 2).join(', ')
            })));
        }

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Album Details (Public) - New Feature
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

// User Actions (Protected)
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        // Return FULL objects now, not just IDs
        const follows = await Follow.findAll({ where: { userId: req.user.id } });
        const likes = await Like.findAll({ where: { userId: req.user.id } });
        const albumFollows = await AlbumFollow.findAll({ where: { userId: req.user.id } });
        res.json({
            follows, // Returns array of Follow objects (artistId, artistName, image)
            likes,    // Returns array of Like objects (trackId, trackName, image, previewUrl)
            albumFollows // Returns array of AlbumFollow objects
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

app.post('/api/follow', authenticateToken, async (req, res) => {
    try {
        const { artistId, artistName, image } = req.body;
        const exists = await Follow.findOne({ where: { userId: req.user.id, artistId } });
        if (exists) {
            await exists.destroy();
            return res.json({ status: 'unfollowed' });
        }
        await Follow.create({ userId: req.user.id, artistId, artistName, image });
        res.json({ status: 'followed' });
    } catch (e) {
        res.status(500).json({ error: 'Action failed' });
    }
});

app.post('/api/like', authenticateToken, async (req, res) => {
    try {
        const { trackId, trackName, image, previewUrl } = req.body; // Expect extra data
        const exists = await Like.findOne({ where: { userId: req.user.id, trackId } });
        if (exists) {
            await exists.destroy();
            return res.json({ status: 'unliked' });
        }
        await Like.create({ userId: req.user.id, trackId, trackName, image, previewUrl });
        res.json({ status: 'liked' });
    } catch (e) {
        res.status(500).json({ error: 'Action failed' });
    }
});

// Album Follow
app.post('/api/follow-album', authenticateToken, async (req, res) => {
    try {
        const { albumId, albumName, image, artistName } = req.body;
        const existing = await AlbumFollow.findOne({ where: { userId: req.user.id, albumId } });
        if (existing) {
            await existing.destroy();
            return res.json({ status: 'unfollowed' });
        }
        await AlbumFollow.create({ userId: req.user.id, albumId, albumName, image, artistName });
        res.json({ status: 'followed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Playlist Routes ---
app.get('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const playlists = await Playlist.findAll({
            where: { userId: req.user.id },
            include: [PlaylistTrack]
        });
        res.json(playlists);
    } catch (e) { res.status(500).json({ error: 'Failed to fetch playlists' }); }
});

app.post('/api/playlists', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const playlist = await Playlist.create({ userId: req.user.id, name });
        res.json(playlist);
    } catch (e) { res.status(500).json({ error: 'Failed to create playlist' }); }
});

app.post('/api/playlists/:id/add', authenticateToken, async (req, res) => {
    try {
        const { trackId, trackName, image, previewUrl } = req.body;
        const playlist = await Playlist.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        await PlaylistTrack.create({
            playlistId: playlist.id, trackId, trackName, image, previewUrl
        });
        res.json({ status: 'added' });
    } catch (e) { res.status(500).json({ error: 'Failed to add track' }); }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
