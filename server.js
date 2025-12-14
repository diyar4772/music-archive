const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_music_key';

app.use(cors());
app.use(express.static('.'));
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
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
    name: { type: String, required: true }
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

// --- Routes: Auth ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, password: hashedPassword });
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
        res.json({ token, username });
    } catch (e) {
        res.status(400).json({ error: 'Username likely taken' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
        res.json({ token, username });
    } catch (e) {
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
        const searchType = type === 'track' ? 'track' : 'artist';
        const searchLimit = type === 'track' ? 10 : 5;

        const searchResp = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=${searchType}&limit=${searchLimit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (type === 'simple') {
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
        const playlists = await Playlist.find({ userId: req.user.id });
        const result = await Promise.all(playlists.map(async (pl) => {
            const tracks = await PlaylistTrack.find({ playlistId: pl._id });
            return {
                id: pl._id,
                name: pl.name,
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
        const playlist = await Playlist.create({ userId: req.user.id, name });
        res.json({ id: playlist._id, name: playlist.name });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

app.post('/api/playlists/:id/add', authenticateToken, async (req, res) => {
    try {
        const { trackId, trackName, image, previewUrl } = req.body;
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
        const playlist = await Playlist.findOne({ _id: req.params.id, userId: req.user.id });
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
        const result = await PlaylistTrack.deleteOne({
            playlistId: req.params.id,
            trackId: req.params.trackId
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Track not found' });
        res.json({ status: 'removed' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove track' });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
