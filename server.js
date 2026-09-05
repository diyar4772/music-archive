const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const path = require('path');

if (process.env.SKIP_DOTENV_CONFIG !== 'true') {
    dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 SECURITY: Secrets come from the environment only. No baked-in fallbacks —
// a hardcoded default would be a published credential once the repo is public.
const requireSecret = (name) => {
    const value = process.env[name];
    if (!value) {
        console.error(`❌ FATAL: ${name} is not set. Copy .env.example to .env and fill it in.`);
        process.exit(1);
    }
    return value;
};

const JWT_SECRET = requireSecret('JWT_SECRET');
const ADMIN_USERNAME = requireSecret('ADMIN_USERNAME');
const ADMIN_PASSWORD = requireSecret('ADMIN_PASSWORD');

// 🔒 SECURITY: Development conveniences are fail-closed — NODE_ENV is not set on
// most hosts, so anything unset must behave as production.
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const spotifyConfigured = () => Boolean(process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim());
if (!spotifyConfigured()) console.warn('⚠️ SPOTIFY_CLIENT_ID/SECRET missing — search and album endpoints return 503.');

const MOCK_AUTH_ENABLED = IS_DEVELOPMENT && process.env.ENABLE_MOCK_AUTH === 'true';

if (MOCK_AUTH_ENABLED) {
    console.warn('⚠️ MOCK AUTH ENABLED: unauthenticated requests act as the first user. Development only!');
}

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

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many admin authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests. Please slow down.' }
});

// 🔒 SECURITY: Per-user rate limiting for Spotify API endpoints
// Prevents individual users from exhausting Spotify API quota
const userLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per user per minute
    keyGenerator: (req) => {
        if (req.user?.id) return `user:${req.user.id}`;
        return `ip:${ipKeyGenerator(req.ip)}`;
    },
    message: { error: 'Too many search requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

// 📱 MOBILE: Enhanced CORS for React Native (Expo) access
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        // Allow all origins in development only
        if (IS_DEVELOPMENT) return callback(null, true);

        // Production: explicit whitelist from CORS_ORIGINS (comma-separated).
        // No host is hardcoded — a domain listed here that later changes hands
        // would be granted credentialed access.
        const allowedOrigins = (process.env.CORS_ORIGINS || '')
            .split(',').map(o => o.trim()).filter(Boolean);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        const error = new Error('Origin is not allowed by CORS');
        error.status = 403;
        error.code = 'CORS_NOT_ALLOWED';
        return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
// 🔒 CORS is an API-only concern. Mounted globally it also gated the static
// frontend, and `<script type="module">` is always fetched in CORS mode — so an
// origin missing from the allowlist made /js/app.js return 403 and the entire
// web app failed to boot. Static assets are same-origin; they need no allowlist.
app.use('/api', cors(corsOptions));
app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.use('/js', express.static(path.join(__dirname, 'js'), { index: false }));
app.use(express.json({ limit: '5mb' })); // Limit payload size

app.get('/api/health', (req, res) => {
    const databaseReady = useInMemory || mongoose.connection.readyState === 1;
    return res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? 'ready' : 'not_ready',
        database: useInMemory ? 'in-memory' : 'mongodb',
        spotify: spotifyConfigured() ? 'configured' : 'missing'
    });
});

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
    ratings: [],
    nextId: 1
};

const generateId = () => {
    return 'local_' + (inMemoryDB.nextId++).toString() + '_' + Date.now();
};

// --- MongoDB Connection ---
const connectDatabase = async () => {
    if (!process.env.MONGO_URI) {
        if (IS_PRODUCTION) {
            throw new Error('MONGO_URI is required in production');
        }
        console.warn('⚠️ MONGO_URI not set - Using In-Memory Database outside production');
        useInMemory = true;
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        useInMemory = false;
        console.log('✅ MongoDB Connected!');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        if (IS_PRODUCTION) throw err;
        console.warn('🔄 Using In-Memory Database outside production');
        useInMemory = true;
    }
};

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, minlength: 3, maxlength: 30 },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
    refreshToken: { type: String, default: null }, // Stores only a SHA-256 hash
    refreshTokenExpiresAt: { type: Date, default: null }
}, { timestamps: true });

// Indexes for User schema - CRITICAL for performance
userSchema.index({ refreshToken: 1 }); // For refresh token lookups (frequent query)
userSchema.index({ lastLogin: -1 }); // For sorting users by last login (admin queries)
userSchema.index({ createdAt: -1 }); // For sorting by registration date

const followSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    artistId: { type: String, required: true },
    artistName: { type: String },
    image: { type: String }
}, { timestamps: true });

// Indexes for Follow schema
followSchema.index({ userId: 1 }); // For user's followed artists
followSchema.index({ artistId: 1 }); // For artist popularity queries

const albumFollowSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    albumId: { type: String, required: true },
    albumName: { type: String },
    image: { type: String },
    artistName: { type: String }
}, { timestamps: true });

// Indexes for AlbumFollow schema
albumFollowSchema.index({ userId: 1 }); // For user's followed albums
albumFollowSchema.index({ albumId: 1 }); // For album popularity queries

const likeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trackId: { type: String, required: true },
    trackName: { type: String },
    artistId: { type: String },
    artistName: { type: String },
    image: { type: String },
    previewUrl: { type: String },
    source: { type: String, default: 'manual' }, // 'manual' or 'dig'
    mood: { type: String, default: null },
    userNote: { type: String, default: null },
    noteUpdatedAt: { type: Date, default: null }
}, { timestamps: true });

// Indexes for Like schema - CRITICAL for performance at scale
likeSchema.index({ userId: 1 }); // For user's liked tracks (most common query)
likeSchema.index({ trackId: 1 }); // For "is track liked?" checks
likeSchema.index({ userId: 1, trackId: 1 }, { unique: true }); // Compound for uniqueness and fast lookups

const playlistSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    coverImage: { type: String, default: null } // Custom cover image URL
}, { timestamps: true });

// Indexes for Playlist schema
playlistSchema.index({ userId: 1 }); // For user's playlists

const playlistTrackSchema = new mongoose.Schema({
    playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
    trackId: { type: String, required: true },
    trackName: { type: String },
    image: { type: String },
    previewUrl: { type: String }
}, { timestamps: true });

// Indexes for PlaylistTrack schema
playlistTrackSchema.index({ playlistId: 1 }); // For playlist tracks (most common query)
playlistTrackSchema.index({ trackId: 1 }); // For finding playlists containing a track

// Rating Schema - Şarkı ve Albüm puanlama
const ratingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: String, required: true }, // trackId veya albumId
    itemType: { type: String, enum: ['track', 'album'], required: true },
    itemName: { type: String },
    artistName: { type: String },
    image: { type: String },
    rating: {
        type: Number,
        min: 0.5,
        max: 5,
        required: true,
        validate: {
            validator: value => Number.isInteger(value * 2),
            message: 'Rating must use 0.5 increments'
        }
    } // 0.5-5 yıldız
}, { timestamps: true });

// Aynı kullanıcı aynı item'ı sadece bir kez puanlayabilir
ratingSchema.index({ userId: 1, itemId: 1, itemType: 1 }, { unique: true });

// LoginHistory Schema - Kullanıcı giriş geçmişi
const loginHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    loginAt: { type: Date, default: Date.now }
}, { timestamps: false });

// Indexes for LoginHistory schema
loginHistorySchema.index({ userId: 1 }); // For user's login history
loginHistorySchema.index({ loginAt: -1 }); // For recent logins sorting

// --- Mongoose Models ---
const User = mongoose.model('User', userSchema);
const Follow = mongoose.model('Follow', followSchema);
const AlbumFollow = mongoose.model('AlbumFollow', albumFollowSchema);
const Like = mongoose.model('Like', likeSchema);
const Playlist = mongoose.model('Playlist', playlistSchema);
const PlaylistTrack = mongoose.model('PlaylistTrack', playlistTrackSchema);
const Rating = mongoose.model('Rating', ratingSchema);
const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

const upsertLike = async (filter, values, LikeModel = Like) => {
    try {
        return await LikeModel.findOneAndUpdate(
            filter,
            { $setOnInsert: values },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                includeResultMetadata: true
            }
        );
    } catch (error) {
        if (error?.code !== 11000) throw error;
        const value = await LikeModel.findOne(filter);
        if (!value) throw error;
        return { value, lastErrorObject: { updatedExisting: true } };
    }
};

const toggleLike = async (filter, values, LikeModel = Like) => {
    const result = await upsertLike(filter, values, LikeModel);
    if (result.lastErrorObject?.updatedExisting) {
        await LikeModel.deleteOne({ _id: result.value._id });
        return 'unliked';
    }
    return 'liked';
};

// --- Spotify Token Management ---
let spotifyToken = null;
let tokenExpiration = 0;

const sendSpotifyError = (res, error) => {
    const status = error.response?.status;
    if (error.code === 'SEARCH_UNAVAILABLE') {
        return res.status(503).json({ error: 'SEARCH_UNAVAILABLE', detail: 'Spotify credentials not configured' });
    }
    if (status === 401 || status === 403) return res.status(502).json({ error: 'SEARCH_UPSTREAM_AUTH_FAILED' });
    if (status === 429) {
        const retryAfter = error.response.headers?.['retry-after'];
        if (retryAfter) res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'SEARCH_RATE_LIMITED' });
    }
    if (!error.response && (error.isAxiosError || ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'].includes(error.code))) {
        return res.status(504).json({ error: 'SEARCH_TIMEOUT' });
    }
    return res.status(502).json({ error: 'SEARCH_UPSTREAM_FAILED' });
};

const getSpotifyToken = async () => {
    if (!spotifyConfigured()) throw Object.assign(new Error('Spotify not configured'), { code: 'SEARCH_UNAVAILABLE' });
    if (spotifyToken && Date.now() < tokenExpiration) return spotifyToken;
    const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const resp = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
    });
    spotifyToken = resp.data.access_token;
    tokenExpiration = Date.now() + (resp.data.expires_in * 1000) - 60000;
    return spotifyToken;
};

// ============================================
// 🎵 iTunes Preview API
// ============================================
// Spotify artık Client Credentials flow'da preview_url vermediği için
// Direkt iTunes Search API kullanıyoruz - her zaman çalışır.

/**
 * iTunes'dan şarkı için audio preview URL'si döndürür.
 * Her zaman iTunes'dan alır - Spotify preview kullanmıyoruz.
 * 
 * @param {string} songName - Şarkı adı
 * @param {string} artistName - Sanatçı adı
 * @returns {Promise<{url: string|null, source: string}>} Preview URL ve kaynağı
 */
const getAudioPreview = async (songName, artistName) => {
    try {
        // Arama terimini oluştur (şarkı adı + sanatçı)
        const searchTerm = `${songName} ${artistName}`;
        const encodedTerm = encodeURIComponent(searchTerm);

        // iTunes Search API'ye istek at
        const response = await axios.get(
            `https://itunes.apple.com/search?term=${encodedTerm}&media=music&entity=song&limit=5`,
            { timeout: 5000 } // 5 saniye timeout
        );

        const results = response.data.results || [];

        if (results.length === 0) {
            return { url: null, source: null };
        }

        // En iyi eşleşmeyi bul (isim ve sanatçı benzerliği)
        const songLower = songName.toLowerCase().trim();
        const artistLower = artistName.toLowerCase().trim();

        // Önce tam eşleşme ara
        let bestMatch = results.find(r => {
            const trackLower = (r.trackName || '').toLowerCase().trim();
            const rArtistLower = (r.artistName || '').toLowerCase().trim();
            return trackLower === songLower && rArtistLower.includes(artistLower);
        });

        // Tam eşleşme yoksa kısmi eşleşme ara
        if (!bestMatch) {
            bestMatch = results.find(r => {
                const trackLower = (r.trackName || '').toLowerCase();
                const rArtistLower = (r.artistName || '').toLowerCase();
                return (trackLower.includes(songLower) || songLower.includes(trackLower)) &&
                    (rArtistLower.includes(artistLower) || artistLower.includes(rArtistLower));
            });
        }

        // Hala bulunamadıysa ilk sonucu al
        if (!bestMatch && results.length > 0) {
            bestMatch = results[0];
        }

        if (bestMatch && bestMatch.previewUrl) {
            return { url: bestMatch.previewUrl, source: 'itunes' };
        }

        return { url: null, source: null };

    } catch (error) {
        console.error(`🎵 iTunes API hatası: ${error.message}`);
        return { url: null, source: null };
    }
};

/**
 * Birden fazla şarkı için iTunes'dan preview URL'lerini toplu olarak getirir.
 * Performans için paralel istekler yapar - HER ZAMAN iTunes kullanır.
 * 
 * @param {Array} tracks - {name, artist} içeren şarkı dizisi
 * @returns {Promise<Array>} Preview URL'leri eklenmiş şarkı dizisi
 */
const enrichTracksWithPreviews = async (tracks) => {
    console.log(`🎵 ${tracks.length} şarkı için iTunes'dan preview alınıyor...`);

    // Her şarkı için paralel olarak iTunes'dan preview al
    const previewPromises = tracks.map(async (track) => {
        const result = await getAudioPreview(track.name, track.artist);
        return { trackId: track.id, ...result };
    });

    const previewResults = await Promise.all(previewPromises);

    // Sonuçları tracks dizisine ekle
    const previewMap = new Map(previewResults.map(r => [r.trackId, r]));

    const enrichedTracks = tracks.map(track => {
        if (previewMap.has(track.id)) {
            const result = previewMap.get(track.id);
            if (result.url) {
                return { ...track, preview_url: result.url, preview_source: 'itunes' };
            }
        }
        // iTunes had nothing: keep whatever Spotify supplied rather than
        // overwriting a working preview with null.
        return { ...track, preview_url: track.preview_url || null };
    });

    const withPreview = enrichedTracks.filter(t => t.preview_url).length;
    console.log(`🎵 iTunes: ${withPreview}/${tracks.length} şarkıda preview bulundu`);

    return enrichedTracks;
};

// --- Middleware ---
// Requires a valid JWT. Falls back to a mock user only when MOCK_AUTH_ENABLED.
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (authHeader && (!authHeader.startsWith('Bearer ') || !token)) return res.sendStatus(401);
    if (token) {
        try {
            const user = jwt.verify(token, JWT_SECRET);
            req.user = user;
            return next();
        } catch (err) {
            return res.sendStatus(401);
        }
    }

    // No token. Mock auth is opt-in via the environment only — never via a request
    // header, which any caller could send to impersonate the first user in the DB.
    if (!MOCK_AUTH_ENABLED) {
        return res.sendStatus(401);
    }

    // Fallback to first user in DB for testing
    if (useInMemory) {
        req.user = { id: 'mock_user_001', username: 'test_user' };
        return next();
    }

    try {
        const firstUser = await User.findOne({}).lean();
        if (firstUser) {
            req.user = { id: firstUser._id.toString(), username: firstUser.username };
        } else {
            // Create test user if none exists
            const testUser = await User.create({
                username: 'mobile_test_user',
                password: await bcrypt.hash('mobile123', 12)
            });
            req.user = { id: testUser._id.toString(), username: testUser.username };
            console.log('📱 Created mobile test user for API testing');
        }
        next();
    } catch (err) {
        console.error('Auth fallback error:', err.message);
        return res.sendStatus(401);
    }
};

// --- Input Validation Helpers ---
const validateUsername = body('username')
    .isString().withMessage('Username must be a string').bail()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
    .escape();

const validatePassword = body('password')
    .isString().withMessage('Password must be a string').bail()
    .isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters');

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');
const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const generateRefreshTokenExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
const generateAccessToken = (user) => jwt.sign({
    id: user._id,
    username: user.username,
    isAdmin: Boolean(user.isAdmin)
}, JWT_SECRET, { expiresIn: '30m' });

const searchCache = new Map();
const SEARCH_CACHE_MAX_ENTRIES = 200;
const cacheGet = (key) => {
    const entry = searchCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        searchCache.delete(key);
        return null;
    }
    return entry.value;
};
const cacheSet = (key, value, ttlSeconds) => {
    if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES && !searchCache.has(key)) {
        searchCache.delete(searchCache.keys().next().value);
    }
    searchCache.set(key, { value, expiresAt: Date.now() + (ttlSeconds * 1000) });
};

// 🔒 SECURITY: Escape special regex characters to prevent injection
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 🔍 SMART SEARCH: Rank results by relevance
const rankSearchResults = (results, query, nameField = 'name') => {
    const queryLower = query.toLowerCase().trim();

    return results.map(item => {
        const name = (item[nameField] || '').toLowerCase().trim();
        let score = 0;

        // Exact match = highest priority (10000 points)
        if (name === queryLower) {
            score = 10000;
        }
        // Name starts with query as complete word (e.g. "ye west" for "ye")
        else if (name.startsWith(queryLower + ' ')) {
            score = 5000;
        }
        // Name starts with query (e.g. "yeat" for "ye")
        else if (name.startsWith(queryLower)) {
            score = 1000;
        }
        // Name contains query as substring (e.g. "kanye" contains "ye")
        else if (name.includes(queryLower)) {
            score = 100;
        }

        // Add popularity bonus (0-100 from Spotify) * 5 = max 500 points
        // This makes very popular artists rank highly even with weaker name matches
        if (item.popularity) {
            score += item.popularity * 5;
        }

        return { ...item, _relevanceScore: score };
    })
        .sort((a, b) => b._relevanceScore - a._relevanceScore)
        .map(({ _relevanceScore, ...item }) => item);
};

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
            const refreshToken = generateRefreshToken();
            const user = {
                _id: userId,
                username,
                password: hashedPassword,
                createdAt: new Date(),
                isAdmin: false,
                refreshToken: hashRefreshToken(refreshToken),
                refreshTokenExpiresAt: generateRefreshTokenExpiry()
            };
            inMemoryDB.users.push(user);
            const token = generateAccessToken(user);
            return res.json({ token, refreshToken, username });
        }

        // Check if username exists (case-insensitive)
        const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const refreshToken = generateRefreshToken();
        const user = await User.create({
            username,
            password: hashedPassword,
            refreshToken: hashRefreshToken(refreshToken),
            refreshTokenExpiresAt: generateRefreshTokenExpiry()
        });
        const token = generateAccessToken(user);
        res.json({ token, refreshToken, username: user.username });
    } catch (e) {
        console.error('Registration error:', e.message);
        res.status(400).json({ error: 'Registration failed. Please try again.' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
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

            // Generate new refresh token on login
            const refreshToken = generateRefreshToken();
            user.refreshToken = hashRefreshToken(refreshToken);
            user.refreshTokenExpiresAt = generateRefreshTokenExpiry();

            // Record login history (in-memory)
            if (!inMemoryDB.loginHistory) inMemoryDB.loginHistory = [];
            inMemoryDB.loginHistory.push({ userId: user._id, loginAt: new Date() });
            // Keep only last 10 per user
            const userHistory = inMemoryDB.loginHistory.filter(h => h.userId === user._id);
            if (userHistory.length > 10) {
                const toRemove = userHistory.slice(0, userHistory.length - 10);
                inMemoryDB.loginHistory = inMemoryDB.loginHistory.filter(h => !toRemove.includes(h));
            }

            const token = generateAccessToken(user);
            return res.json({ token, refreshToken, username: user.username });
        }

        const user = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(username)}$`, 'i') } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate new refresh token on login
        const refreshToken = generateRefreshToken();
        user.refreshToken = hashRefreshToken(refreshToken);
        user.refreshTokenExpiresAt = generateRefreshTokenExpiry();

        // Update login stats
        user.lastLogin = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        // Record login history
        await LoginHistory.create({ userId: user._id });

        // Keep only last 10 login records per user
        const historyCount = await LoginHistory.countDocuments({ userId: user._id });
        if (historyCount > 10) {
            const oldRecords = await LoginHistory.find({ userId: user._id })
                .sort({ loginAt: 1 })
                .limit(historyCount - 10);
            await LoginHistory.deleteMany({ _id: { $in: oldRecords.map(r => r._id) } });
        }

        const token = generateAccessToken(user);
        res.json({ token, refreshToken, username: user.username });
    } catch (e) {
        console.error('Login error:', e.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// --- Refresh Token Endpoint ---
app.post('/api/auth/refresh', authLimiter, async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (typeof refreshToken !== 'string' || !refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const refreshTokenHash = hashRefreshToken(refreshToken);
        const nextRefreshToken = generateRefreshToken();
        const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
        const nextRefreshTokenExpiresAt = generateRefreshTokenExpiry();

        if (useInMemory) {
            const user = inMemoryDB.users.find(u => u.refreshToken === refreshTokenHash);
            if (!user || !(user.refreshTokenExpiresAt instanceof Date) || user.refreshTokenExpiresAt <= new Date()) {
                if (user) {
                    user.refreshToken = null;
                    user.refreshTokenExpiresAt = null;
                }
                return res.status(401).json({ error: 'Invalid refresh token' });
            }

            user.refreshToken = nextRefreshTokenHash;
            user.refreshTokenExpiresAt = nextRefreshTokenExpiresAt;
            const token = generateAccessToken(user);
            return res.json({ token, refreshToken: nextRefreshToken });
        }

        // MongoDB: Find user by refresh token
        const user = await User.findOneAndUpdate(
            { refreshToken: refreshTokenHash, refreshTokenExpiresAt: { $gt: new Date() } },
            { $set: { refreshToken: nextRefreshTokenHash, refreshTokenExpiresAt: nextRefreshTokenExpiresAt } },
            { new: true }
        );
        if (!user) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const token = generateAccessToken(user);
        res.json({ token, refreshToken: nextRefreshToken });
    } catch (e) {
        console.error('Refresh token error:', e.message);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

app.post('/api/logout', authLimiter, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (typeof refreshToken !== 'string' || !refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        const refreshTokenHash = hashRefreshToken(refreshToken);
        if (useInMemory) {
            const user = inMemoryDB.users.find(u => u.refreshToken === refreshTokenHash);
            if (user) {
                user.refreshToken = null;
                user.refreshTokenExpiresAt = null;
            }
        } else {
            await User.updateOne(
                { refreshToken: refreshTokenHash },
                { $set: { refreshToken: null, refreshTokenExpiresAt: null } }
            );
        }

        return res.json({ status: 'logged_out' });
    } catch (e) {
        console.error('Logout error:', e.message);
        return res.status(500).json({ error: 'Logout failed' });
    }
});

// --- Routes: Data (Public) ---

// Search - Protected with per-user rate limiting
app.get('/api/search', userLimiter, async (req, res) => {
    try {
        const { artist, type } = req.query;
        if (typeof artist !== 'string' || !artist.trim()) return res.status(400).json({ error: 'Missing query' });

        const cacheKey = `search:${type || 'artist'}:${artist.trim().toLowerCase()}`;
        const cachedResult = cacheGet(cacheKey);
        if (cachedResult) return res.json(cachedResult);

        const token = await getSpotifyToken();

        // Determine search type based on request
        let spotifyType = 'artist';
        let searchLimit = 10; // Spotify development-mode maximum

        if (type === 'track') {
            spotifyType = 'track';
            searchLimit = 10;
        } else if (type === 'album') {
            spotifyType = 'album';
            searchLimit = 10;
        }

        const searchResp = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=${spotifyType}&limit=${searchLimit}`, {
            headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000
        });

        if (type === 'simple') {
            const artistData = searchResp.data.artists.items[0];
            if (!artistData) return res.status(404).json({ error: 'Artist not found' });

            // Fetch ALL albums using pagination
            let allAlbums = [];
            let offset = 0;
            const limit = 10; // Compatible with Spotify development mode
            let hasMore = true;

            while (hasMore) {
                const albumsResp = await axios.get(
                    `https://api.spotify.com/v1/artists/${artistData.id}/albums?include_groups=album,single&limit=${limit}&offset=${offset}`,
                    { headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000 }
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

            const result = {
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
            };
            cacheSet(cacheKey, result, 3600);
            return res.json(result);
        }

        // Album search results - with smart ranking
        if (type === 'album') {
            let albums = searchResp.data.albums.items.map(a => ({
                id: a.id,
                name: a.name,
                artist: a.artists[0]?.name || 'Unknown',
                image: a.images[0]?.url,
                year: a.release_date?.split('-')[0] || '',
                totalTracks: a.total_tracks,
                popularity: a.popularity
            }));
            const rankedAlbums = rankSearchResults(albums, artist, 'name');
            // Cache results for 1 hour
            await cacheSet(cacheKey, rankedAlbums, 3600);
            return res.json(rankedAlbums);
        }

        // Track search results - with smart ranking
        if (type === 'track') {
            // Spotify'dan gelen track verilerini formatla
            const tracks = searchResp.data.tracks.items.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artists[0].name,
                artistId: t.artists[0].id, // Added for like API
                image: t.album.images[0]?.url,
                preview_url: t.preview_url,
                duration_ms: t.duration_ms,
                popularity: t.popularity
            }));

            // Smart rank first
            const rankedTracks = rankSearchResults(tracks, artist, 'name');

            // Spotify preview yoksa iTunes'dan al (enrichTracksWithPreviews fonksiyonu)
            const enrichedTracks = await enrichTracksWithPreviews(rankedTracks);

            // Cache results for 1 hour
            await cacheSet(cacheKey, enrichedTracks, 3600);
            return res.json(enrichedTracks);
        }

        // Artist search results (default) - with smart ranking
        const artists = searchResp.data.artists.items.map(a => ({
            id: a.id,
            name: a.name,
            image: a.images[0]?.url || null,
            genres: (a.genres || []).slice(0, 2).join(', '),
            popularity: a.popularity // Keep for ranking
        }));

        // Smart rank: exact match first, then starts with, then by popularity
        const rankedArtists = rankSearchResults(artists, artist, 'name');
        // Cache results for 1 hour
        await cacheSet(cacheKey, rankedArtists, 3600);
        res.json(rankedArtists);
    } catch (e) {
        return sendSpotifyError(res, e);
    }
});

// Album Details - Rate limited to protect Spotify API quota
app.get('/api/album/:id', generalLimiter, async (req, res) => {
    try {
        const cacheKey = `album:${req.params.id}`;
        const cached = cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const token = await getSpotifyToken();
        const resp = await axios.get(`https://api.spotify.com/v1/albums/${encodeURIComponent(req.params.id)}`, {
            headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000
        });

        const artist = resp.data.artists[0]?.name || 'Unknown';
        // Spotify stopped returning preview_url for most markets, which left every
        // play button in the album modal dead. Same iTunes enrichment the track
        // search already uses.
        const tracks = await enrichTracksWithPreviews(resp.data.tracks.items.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artists?.[0]?.name || artist,
            duration_ms: t.duration_ms,
            preview_url: t.preview_url,
            spotify_url: t.external_urls?.spotify
        })));

        const album = {
            id: resp.data.id,
            name: resp.data.name,
            image: resp.data.images[0]?.url,
            artist,
            releaseDate: resp.data.release_date || '',
            totalTracks: resp.data.total_tracks,
            tracks
        };
        cacheSet(cacheKey, album, 3600);
        res.json(album);
    } catch (e) {
        return sendSpotifyError(res, e);
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
            const ratings = inMemoryDB.ratings.filter(r => r.userId === req.user.id);
            return res.json({
                follows: follows.map(f => ({ artistId: f.artistId, artistName: f.artistName, image: f.image })),
                likes: likes.map(l => ({ trackId: l.trackId, trackName: l.trackName, artistName: l.artistName || 'Unknown Artist', image: l.image, previewUrl: l.previewUrl, userNote: l.userNote, noteUpdatedAt: l.noteUpdatedAt })),
                albumFollows: albumFollows.map(a => ({ albumId: a.albumId, albumName: a.albumName, image: a.image, artistName: a.artistName })),
                ratings: ratings.map(r => ({ itemId: r.itemId, itemType: r.itemType, itemName: r.itemName, artistName: r.artistName, image: r.image, rating: r.rating }))
            });
        }

        const follows = await Follow.find({ userId: req.user.id });
        const likes = await Like.find({ userId: req.user.id });
        const albumFollows = await AlbumFollow.find({ userId: req.user.id });
        const ratings = await Rating.find({ userId: req.user.id });

        res.json({
            follows: follows.map(f => ({ artistId: f.artistId, artistName: f.artistName, image: f.image })),
            likes: likes.map(l => ({ trackId: l.trackId, trackName: l.trackName, artistName: l.artistName || 'Unknown Artist', image: l.image, previewUrl: l.previewUrl, userNote: l.userNote, noteUpdatedAt: l.noteUpdatedAt })),
            albumFollows: albumFollows.map(a => ({ albumId: a.albumId, albumName: a.albumName, image: a.image, artistName: a.artistName })),
            ratings: ratings.map(r => ({ itemId: r.itemId, itemType: r.itemType, itemName: r.itemName, artistName: r.artistName, image: r.image, rating: r.rating }))
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// The library namespace is canonical. Legacy adapters preserve toggle/idempotent
// semantics and response envelopes for existing web and mobile clients.
const followArtistHandler = async (req, res) => {
    try {
        const { artistId, artistName, image } = req.body;
        if (typeof artistId !== 'string' || !artistId.trim() || typeof artistName !== 'string' || !artistName.trim()) {
            return res.status(400).json({ error: 'artistId and artistName are required' });
        }
        const filter = { userId: req.user.id, artistId };
        let followed;
        if (useInMemory) {
            const index = inMemoryDB.follows.findIndex(f => f.userId === filter.userId && f.artistId === artistId);
            followed = index === -1;
            if (followed) inMemoryDB.follows.push({ _id: generateId(), ...filter, artistName, image, createdAt: new Date() });
            else inMemoryDB.follows.splice(index, 1);
        } else {
            const existing = await Follow.findOne(filter);
            followed = !existing;
            if (existing) await Follow.deleteOne({ _id: existing._id });
            else await Follow.create({ ...filter, artistName, image });
        }
        const status = followed ? 'followed' : 'unfollowed';
        return res.json(req.path.startsWith('/api/library/')
            ? { success: true, action: status, message: `${status} ${artistName}` }
            : { status });
    } catch {
        return res.status(500).json({ error: 'Action failed' });
    }
};
app.post('/api/library/follow', authenticateToken, followArtistHandler);
app.post('/api/follow', authenticateToken, followArtistHandler);

const likeTrackHandler = async (req, res) => {
    try {
        const library = req.path.startsWith('/api/library/');
        const input = req.body;
        const trackId = library ? input.spotifyId : input.trackId;
        const trackName = library ? input.title : input.trackName;
        if (typeof trackId !== 'string' || !trackId.trim() || (library && (typeof trackName !== 'string' || !trackName.trim()))) {
            return res.status(400).json({ error: library ? 'spotifyId and title are required' : 'trackId is required' });
        }
        const filter = { userId: req.user.id, trackId };
        const artist = library ? input.artist : input.artistName;
        const values = { ...filter, trackName, artistId: input.artistId || null,
            artistName: (Array.isArray(artist) ? artist[0] : artist) || 'Unknown Artist',
            image: library ? input.albumArt : input.image, previewUrl: input.previewUrl,
            source: input.source || 'manual', mood: input.mood || null };
        let status;
        if (useInMemory) {
            const index = inMemoryDB.likes.findIndex(l => l.userId === filter.userId && l.trackId === trackId);
            if (index === -1) {
                inMemoryDB.likes.push({ _id: generateId(), ...values, userNote: null, noteUpdatedAt: null, createdAt: new Date() });
                status = 'liked';
            } else if (library) status = 'exists';
            else { inMemoryDB.likes.splice(index, 1); status = 'unliked'; }
        } else if (library) {
            const result = await upsertLike(filter, values);
            status = result.lastErrorObject?.updatedExisting ? 'exists' : 'liked';
        } else status = await toggleLike(filter, values);
        return res.json(library
            ? { success: true, message: status === 'exists' ? 'Already in Library' : 'Added to Library', action: status === 'exists' ? 'exists' : 'added' }
            : { status });
    } catch {
        return res.status(500).json({ error: 'Action failed' });
    }
};
app.post('/api/library/like', authenticateToken, likeTrackHandler);
app.post('/api/like', authenticateToken, likeTrackHandler);

// Follow Artist

// Like Track

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

// ============================================
// ⭐ RATING ROUTES - Şarkı ve Albüm Puanlama
// ============================================

// Rate a Track or Album (1-5 stars)
app.post('/api/rate', authenticateToken, async (req, res) => {
    try {
        const { itemId, itemType, itemName, artistName, image, rating } = req.body;

        // Validation
        if (typeof itemId !== 'string' || !itemId.trim() || typeof itemType !== 'string' || !itemType || rating === undefined) {
            return res.status(400).json({ error: 'itemId, itemType, and rating are required' });
        }
        if (!['track', 'album'].includes(itemType)) {
            return res.status(400).json({ error: 'itemType must be "track" or "album"' });
        }
        if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0.5 || rating > 5 || !Number.isInteger(rating * 2)) {
            return res.status(400).json({ error: 'Rating must be between 0.5 and 5 in 0.5 increments' });
        }

        if (useInMemory) {
            // Check if rating exists
            const existsIdx = inMemoryDB.ratings.findIndex(
                r => r.userId === req.user.id && r.itemId === itemId && r.itemType === itemType
            );

            if (existsIdx !== -1) {
                // Update existing rating
                inMemoryDB.ratings[existsIdx].rating = rating;
                inMemoryDB.ratings[existsIdx].updatedAt = new Date();
                return res.json({ status: 'updated', rating });
            }

            // Create new rating
            inMemoryDB.ratings.push({
                _id: generateId(),
                userId: req.user.id,
                itemId,
                itemType,
                itemName,
                artistName,
                image,
                rating,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return res.json({ status: 'rated', rating });
        }

        // MongoDB: upsert (update or insert)
        const result = await Rating.findOneAndUpdate(
            { userId: req.user.id, itemId, itemType },
            { itemName, artistName, image, rating },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({
            status: result.createdAt === result.updatedAt ? 'rated' : 'updated',
            rating: result.rating
        });
    } catch (e) {
        console.error('Rating error:', e.message);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

// Get ratings for an item (with average)
app.get('/api/ratings/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { itemType } = req.query;

        if (useInMemory) {
            const ratings = inMemoryDB.ratings.filter(
                r => r.itemId === itemId && (!itemType || r.itemType === itemType)
            );

            const totalRatings = ratings.length;
            const averageRating = totalRatings > 0
                ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
                : 0;

            return res.json({
                itemId,
                totalRatings,
                averageRating: Math.round(averageRating * 10) / 10, // 1 decimal
                ratings: ratings.map(r => ({ rating: r.rating, createdAt: r.createdAt }))
            });
        }

        const filter = itemType ? { itemId, itemType } : { itemId };
        const ratings = await Rating.find(filter);

        const totalRatings = ratings.length;
        const averageRating = totalRatings > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
            : 0;

        res.json({
            itemId,
            totalRatings,
            averageRating: Math.round(averageRating * 10) / 10,
            ratings: ratings.map(r => ({ rating: r.rating, createdAt: r.createdAt }))
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

// Delete a rating
app.delete('/api/rate/:itemId', authenticateToken, async (req, res) => {
    try {
        const { itemId } = req.params;
        const { itemType } = req.query;

        if (useInMemory) {
            const idx = inMemoryDB.ratings.findIndex(
                r => r.userId === req.user.id && r.itemId === itemId && (!itemType || r.itemType === itemType)
            );
            if (idx === -1) return res.status(404).json({ error: 'Rating not found' });

            inMemoryDB.ratings.splice(idx, 1);
            return res.json({ status: 'deleted' });
        }

        const filter = itemType
            ? { userId: req.user.id, itemId, itemType }
            : { userId: req.user.id, itemId };

        const result = await Rating.deleteOne(filter);
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Rating not found' });
        }
        res.json({ status: 'deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete rating' });
    }
});

const listPlaylistsHandler = async (req, res) => {
    try {
        const filter = { userId: req.user.id };
        const playlists = useInMemory ? inMemoryDB.playlists.filter(p => p.userId === filter.userId)
            : await Playlist.find(filter).sort({ createdAt: -1 }).lean();
        const result = await Promise.all(playlists.map(async p => {
            const tracks = useInMemory ? inMemoryDB.playlistTracks.filter(t => t.playlistId === p._id)
                : await PlaylistTrack.find({ playlistId: p._id }).lean();
            return { id: p._id, name: p.name, coverImage: p.coverImage || null, createdAt: p.createdAt,
                trackCount: tracks.length, PlaylistTracks: tracks };
        }));
        return res.json(req.path.startsWith('/api/library/') ? { playlists: result } : result);
    } catch {
        return res.status(500).json({ error: 'Failed to fetch playlists' });
    }
};
const createPlaylistHandler = async (req, res) => {
    try {
        if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }
        const name = req.body.name.trim().substring(0, 100).replace(/[<>]/g, '');
        if (!name) return res.status(400).json({ error: 'Playlist name cannot be empty' });
        const values = { userId: req.user.id, name, coverImage: req.body.coverImage || null, createdAt: new Date() };
        const playlist = useInMemory ? { _id: generateId(), ...values } : await Playlist.create(values);
        if (useInMemory) inMemoryDB.playlists.push(playlist);
        const result = { id: playlist._id, name, coverImage: playlist.coverImage, createdAt: playlist.createdAt, trackCount: 0 };
        return res.json(req.path.startsWith('/api/library/') ? { playlist: result, message: 'Playlist created' } : result);
    } catch {
        return res.status(500).json({ error: 'Failed to create playlist' });
    }
};
app.get('/api/library/playlists', authenticateToken, listPlaylistsHandler);
app.get('/api/playlists', authenticateToken, listPlaylistsHandler);
app.post('/api/library/playlists', authenticateToken, createPlaylistHandler);
app.post('/api/playlists', authenticateToken, createPlaylistHandler);

// --- Playlist Routes ---


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
        let { coverImage } = req.body;
        const decodedId = decodeURIComponent(req.params.id);

        // 🔒 SECURITY: Validate cover image URL
        if (coverImage) {
            if (typeof coverImage !== 'string') {
                return res.status(400).json({ error: 'Invalid cover image' });
            }
            coverImage = coverImage.trim().substring(0, 2000); // Max URL length

            // Allow data URLs (base64) or valid HTTP(S) URLs
            const isDataUrl = coverImage.startsWith('data:image/');
            const isHttpUrl = /^https?:\/\/.+\..+/.test(coverImage);

            if (!isDataUrl && !isHttpUrl) {
                return res.status(400).json({ error: 'Invalid image URL format' });
            }

            // Block potential XSS in URLs
            if (coverImage.includes('<') || coverImage.includes('>') || coverImage.includes('javascript:')) {
                return res.status(400).json({ error: 'Invalid characters in URL' });
            }
        }

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
const timingSafeStringEqual = (provided, expected) => {
    const providedBuffer = Buffer.from(String(provided ?? ''), 'utf8');
    const expectedBuffer = Buffer.from(String(expected ?? ''), 'utf8');
    const length = Math.max(providedBuffer.length, expectedBuffer.length);
    const paddedProvided = Buffer.alloc(length);
    const paddedExpected = Buffer.alloc(length);
    providedBuffer.copy(paddedProvided);
    expectedBuffer.copy(paddedExpected);
    return crypto.timingSafeEqual(paddedProvided, paddedExpected) &&
        providedBuffer.length === expectedBuffer.length;
};

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Check for Basic Auth (admin:password)
    if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');

        const usernameMatches = timingSafeStringEqual(username, ADMIN_USERNAME);
        const passwordMatches = timingSafeStringEqual(password, ADMIN_PASSWORD);
        if (usernameMatches && passwordMatches) {
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

app.use(['/api/admin', '/admin', '/admin.html'], adminLimiter);

// 📊 Get all users with stats (with search and sorting)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const { search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        // Valid sort fields
        const validSortFields = ['username', 'createdAt', 'lastLogin', 'loginCount', 'likesCount', 'followsCount', 'playlistsCount'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const actualSortOrder = sortOrder === 'asc' ? 1 : -1;

        if (useInMemory) {
            let users = inMemoryDB.users.map(u => ({
                id: u._id,
                username: u.username,
                createdAt: u.createdAt,
                lastLogin: u.lastLogin,
                loginCount: u.loginCount || 0,
                isAdmin: u.isAdmin || false,
                likesCount: inMemoryDB.likes.filter(l => l.userId === u._id).length,
                followsCount: inMemoryDB.follows.filter(f => f.userId === u._id).length,
                albumFollowsCount: inMemoryDB.albumFollows.filter(a => a.userId === u._id).length,
                playlistsCount: inMemoryDB.playlists.filter(p => p.userId === u._id).length
            }));

            // Search filter
            if (search && search.trim()) {
                const searchLower = search.toLowerCase().trim();
                users = users.filter(u => u.username.toLowerCase().includes(searchLower));
            }

            // Sorting
            users.sort((a, b) => {
                let valA = a[actualSortBy];
                let valB = b[actualSortBy];
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return -1 * actualSortOrder;
                if (valA > valB) return 1 * actualSortOrder;
                return 0;
            });

            return res.json({ total: users.length, users });
        }

        // MongoDB: Build query with optional search
        let query = {};
        if (search && search.trim()) {
            query.username = { $regex: escapeRegex(search.trim()), $options: 'i' };
        }

        // For stats-based sorting, we need to fetch all and sort in memory
        const needsStatSort = ['likesCount', 'followsCount', 'playlistsCount'].includes(actualSortBy);

        let users;
        if (needsStatSort) {
            users = await User.find(query, '-password');
        } else {
            const mongoSort = {};
            mongoSort[actualSortBy] = actualSortOrder;
            users = await User.find(query, '-password').sort(mongoSort);
        }

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

        // Sort by stats if needed
        if (needsStatSort) {
            userStats.sort((a, b) => {
                const valA = a[actualSortBy] || 0;
                const valB = b[actualSortBy] || 0;
                return (valA - valB) * actualSortOrder * -1;
            });
        }

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

// 📅 Get user login history
app.get('/api/admin/users/:userId/logins', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (useInMemory) {
            const history = (inMemoryDB.loginHistory || [])
                .filter(h => h.userId === userId)
                .sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt))
                .slice(0, 10);
            return res.json({ userId, loginHistory: history });
        }

        const history = await LoginHistory.find({ userId })
            .sort({ loginAt: -1 })
            .limit(10);

        res.json({ userId, loginHistory: history.map(h => ({ loginAt: h.loginAt })) });
    } catch (e) {
        console.error('Login history error:', e.message);
        res.status(500).json({ error: 'Failed to fetch login history' });
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
            inMemoryDB.ratings = inMemoryDB.ratings.filter(r => r.userId !== userId);
            inMemoryDB.loginHistory = (inMemoryDB.loginHistory || []).filter(h => h.userId !== userId);
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
            Rating.deleteMany({ userId }),
            LoginHistory.deleteMany({ userId }),
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

// Redirect /admin to the actual file
app.get(['/admin', '/admin.html'], (req, res) => {
    res.sendFile(__dirname + '/panel-4772.html');
});

// ===================================================
// 🃏 DIG MODE API - Sprint 2 (Smart Mix Algorithm)
// ===================================================

// Helper: Get random items from array
const getRandomItems = (arr, count) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

// Dig Mode: Get SMART personalized tracks queue - Rate limited to protect Spotify API
app.get('/api/dig/queue', authenticateToken, userLimiter, async (req, res) => {
    try {
        const { mood, limit = 15 } = req.query;
        const userId = req.user.id;
        const token = await getSpotifyToken();

        let seedTracks = [];
        let seedArtists = [];
        let userLikedTrackIds = [];

        // =============================================
        // STEP 1: Data Mining - Get User's Seeds
        // =============================================

        if (useInMemory) {
            const userLikes = inMemoryDB.likes.filter(l => l.userId === userId);
            const userFollows = inMemoryDB.follows.filter(f => f.userId === userId);
            userLikedTrackIds = userLikes.map(l => l.trackId);

            if (userLikes.length > 0) {
                const sortedLikes = [...userLikes].sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt));
                const recentLikes = sortedLikes.slice(0, 5);
                const freshTaste = getRandomItems(recentLikes, 2).map(l => l.trackId).filter(Boolean);
                const oldLikes = sortedLikes.slice(-10);
                const deepCut = oldLikes.length > 0 ? [oldLikes[Math.floor(Math.random() * oldLikes.length)].trackId].filter(Boolean) : [];
                seedTracks = [...freshTaste, ...deepCut].filter(Boolean);
            }
            if (userFollows.length > 0) {
                seedArtists = getRandomItems(userFollows, 2).map(f => f.artistId).filter(Boolean);
            }
        } else {
            const userLikes = await Like.find({ userId }).sort({ createdAt: -1 });
            const userFollows = await Follow.find({ userId });
            userLikedTrackIds = userLikes.map(l => l.trackId);

            if (userLikes.length > 0) {
                const freshTaste = getRandomItems(userLikes.slice(0, 5), 2).map(l => l.trackId).filter(Boolean);
                const deepCut = userLikes.length > 5 ? [userLikes[Math.floor(Math.random() * userLikes.length)].trackId].filter(Boolean) : [];
                seedTracks = [...freshTaste, ...deepCut].filter(Boolean);
            }
            if (userFollows.length > 0) {
                seedArtists = getRandomItems(userFollows, 2).map(f => f.artistId).filter(Boolean);
            }
        }

        console.log(`🎯 Smart Mix - Seeds: ${seedTracks.length} tracks, ${seedArtists.length} artists`);

        // =============================================
        // STEP 2: Spotify Recommendations or Fallback
        // =============================================

        let tracks = [];

        if (seedTracks.length > 0 || seedArtists.length > 0) {
            try {
                const params = new URLSearchParams({ limit: '30', min_popularity: '20' });
                if (seedTracks.length > 0) params.append('seed_tracks', seedTracks.slice(0, 3).join(','));
                if (seedArtists.length > 0) params.append('seed_artists', seedArtists.slice(0, 2).join(','));

                if (mood === 'energy') { params.append('min_energy', '0.7'); params.append('min_tempo', '120'); }
                else if (mood === 'chill') { params.append('max_energy', '0.5'); }
                else if (mood === 'party') { params.append('min_danceability', '0.7'); }

                const recResp = await axios.get(`https://api.spotify.com/v1/recommendations?${params.toString()}`,
                    { headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000 });

                tracks = recResp.data.tracks.map(t => ({
                    id: t.id, name: t.name, artist: t.artists[0]?.name || 'Unknown',
                    artistId: t.artists[0]?.id, album: t.album.name, albumId: t.album.id,
                    image: t.album.images[0]?.url, preview_url: t.preview_url,
                    duration_ms: t.duration_ms, popularity: t.popularity, external_url: t.external_urls?.spotify
                }));
                console.log(`✨ Personalized: ${tracks.length} recommendations`);
            } catch (recError) { console.error('Rec API error:', recError.message); }
        }

        // Cold Start Fallback
        if (tracks.length === 0) {
            console.log('❄️ Cold Start - Using popular tracks');
            const terms = ['top hits 2024', 'popular songs', 'trending music'];
            const searchResp = await axios.get(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(terms[Math.floor(Math.random() * terms.length)])}&type=track&limit=10`,
                { headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000 });
            tracks = searchResp.data.tracks.items.map(t => ({
                id: t.id, name: t.name, artist: t.artists[0]?.name || 'Unknown',
                artistId: t.artists[0]?.id, album: t.album.name, albumId: t.album.id,
                image: t.album.images[0]?.url, preview_url: t.preview_url,
                duration_ms: t.duration_ms, popularity: t.popularity, external_url: t.external_urls?.spotify
            }));
        }

        // =============================================
        // STEP 3: Deduplication & Enrich
        // =============================================

        const freshTracks = tracks.filter(t => !userLikedTrackIds.includes(t.id));
        const enrichedTracks = await enrichTracksWithPreviews(freshTracks);
        const finalTracks = enrichedTracks.filter(t => t.preview_url).slice(0, parseInt(limit));

        console.log(`🎵 Serving ${finalTracks.length} tracks (personalized: ${seedTracks.length > 0})`);
        res.json({ tracks: finalTracks, total: finalTracks.length, personalized: seedTracks.length > 0 || seedArtists.length > 0 });
    } catch (e) {
        console.error('Dig queue error:', e.message);
        res.status(500).json({ error: 'Failed to get dig queue' });
    }
});

// Dig Mode: Handle swipe action
app.post('/api/dig/swipe', authenticateToken, userLimiter, async (req, res) => {
    try {
        const { trackId, trackName, artistId, artistName, albumId, image, action, mood } = req.body;
        const userId = req.user.id;

        if (!trackId || !action) {
            return res.status(400).json({ error: 'trackId and action required' });
        }

        // Valid actions: pass, archive, explore
        if (!['pass', 'archive', 'explore'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use: pass, archive, explore' });
        }

        // If action is 'archive', add to likes
        if (action === 'archive') {
            if (useInMemory) {
                const exists = inMemoryDB.likes.find(l => l.trackId === trackId && l.userId === userId);
                if (!exists) {
                    inMemoryDB.likes.push({
                        _id: generateId(),
                        userId,
                        trackId,
                        trackName: trackName || '',
                        artistId: artistId || '',
                        artistName: artistName || '',
                        image: image || '',
                        mood: mood || null,
                        source: 'dig',
                        createdAt: new Date()
                    });
                }
            } else {
                const exists = await Like.findOne({ userId, trackId });
                if (!exists) {
                    await Like.create({
                        userId,
                        trackId,
                        trackName: trackName || '',
                        artistId: artistId || '',
                        artistName: artistName || '',
                        image: image || '',
                        mood: mood || null,
                        source: 'dig'
                    });
                }
            }
        }

        // TODO: Store swipe history for analytics (optional, Sprint 3)

        res.json({
            success: true,
            action,
            trackId,
            message: action === 'archive' ? 'Added to your archive!' : 'Swiped ' + action
        });
    } catch (e) {
        console.error('Dig swipe error:', e.message);
        res.status(500).json({ error: 'Failed to process swipe' });
    }
});

// ===================================================
// 📚 LIBRARY DASHBOARD API - Mobile App Backend
// ===================================================

// Library Dashboard: Get stats for the command center cards
app.get('/api/library/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        if (useInMemory) {
            const likedTracksCount = inMemoryDB.likes.filter(l => l.userId === userId).length;
            const followedArtistsCount = inMemoryDB.follows.filter(f => f.userId === userId).length;
            const playlistsCount = inMemoryDB.playlists.filter(p => p.userId === userId).length;
            const albumsCount = inMemoryDB.albumFollows.filter(a => a.userId === userId).length;

            return res.json({
                likedTracksCount,
                followedArtistsCount,
                playlistsCount,
                albumsCount,
                totalItems: likedTracksCount + followedArtistsCount + playlistsCount + albumsCount
            });
        }

        // MongoDB counts
        const [likedTracksCount, followedArtistsCount, playlistsCount, albumsCount] = await Promise.all([
            Like.countDocuments({ userId }),
            Follow.countDocuments({ userId }),
            Playlist.countDocuments({ userId }),
            AlbumFollow.countDocuments({ userId })
        ]);

        res.json({
            likedTracksCount,
            followedArtistsCount,
            playlistsCount,
            albumsCount,
            totalItems: likedTracksCount + followedArtistsCount + playlistsCount + albumsCount
        });
    } catch (e) {
        console.error('Dashboard stats error:', e.message);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

// Library Tracks: Get user's liked tracks with filtering/sorting
app.get('/api/library/tracks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { search, sort = 'date', mood, limit = 50, offset = 0 } = req.query;

        if (useInMemory) {
            let tracks = inMemoryDB.likes.filter(l => l.userId === userId);

            // Local search filter
            if (search) {
                const searchLower = search.toLowerCase();
                tracks = tracks.filter(t =>
                    (t.trackName || '').toLowerCase().includes(searchLower) ||
                    (t.artistName || '').toLowerCase().includes(searchLower)
                );
            }

            // Mood filter
            if (mood && mood !== 'all') {
                tracks = tracks.filter(t => t.mood === mood);
            }

            // Sort
            if (sort === 'name') {
                tracks.sort((a, b) => (a.trackName || '').localeCompare(b.trackName || ''));
            } else if (sort === 'artist') {
                tracks.sort((a, b) => (a.artistName || '').localeCompare(b.artistName || ''));
            } else {
                // Default: date (most recent first)
                tracks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            const total = tracks.length;
            tracks = tracks.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

            return res.json({ tracks, total, offset: parseInt(offset), limit: parseInt(limit) });
        }

        // MongoDB query
        let query = { userId };

        // Search filter (regex)
        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { trackName: searchRegex },
                { artistName: searchRegex }
            ];
        }

        // Mood filter
        if (mood && mood !== 'all') {
            query.mood = mood;
        }

        // Sort options
        let sortOption = { createdAt: -1 }; // Default: most recent
        if (sort === 'name') sortOption = { trackName: 1 };
        else if (sort === 'artist') sortOption = { artistName: 1 };

        const total = await Like.countDocuments(query);
        const tracks = await Like.find(query)
            .sort(sortOption)
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean();

        res.json({
            tracks: tracks.map(t => ({
                trackId: t.trackId,
                trackName: t.trackName,
                artistId: t.artistId,
                artistName: t.artistName || 'Unknown Artist',
                image: t.image,
                previewUrl: t.previewUrl,
                mood: t.mood,
                source: t.source,
                addedAt: t.createdAt
            })),
            total,
            offset: parseInt(offset),
            limit: parseInt(limit)
        });
    } catch (e) {
        console.error('Library tracks error:', e.message);
        res.status(500).json({ error: 'Failed to get library tracks' });
    }
});

// Library: Get user's followed artists
app.get('/api/library/artists', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { search, limit = 50, offset = 0 } = req.query;

        if (useInMemory) {
            let artists = inMemoryDB.follows.filter(f => f.userId === userId);

            if (search) {
                const searchLower = search.toLowerCase();
                artists = artists.filter(a =>
                    (a.artistName || '').toLowerCase().includes(searchLower)
                );
            }

            const total = artists.length;
            artists = artists.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

            return res.json({ artists, total });
        }

        let query = { userId };
        if (search) {
            query.artistName = new RegExp(escapeRegex(search), 'i');
        }

        const total = await Follow.countDocuments(query);
        const artists = await Follow.find(query)
            .sort({ createdAt: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .lean();

        res.json({
            artists: artists.map(a => ({
                artistId: a.artistId,
                artistName: a.artistName,
                image: a.image,
                followedAt: a.createdAt
            })),
            total
        });
    } catch (e) {
        console.error('Library artists error:', e.message);
        res.status(500).json({ error: 'Failed to get followed artists' });
    }
});

// Library: Get user's playlists

// Library: Create new playlist

// Library: Delete a liked track
app.delete('/api/library/track/:trackId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { trackId } = req.params;

        if (useInMemory) {
            const idx = inMemoryDB.likes.findIndex(l => l.userId === userId && l.trackId === trackId);
            if (idx === -1) {
                return res.status(404).json({ error: 'Track not found in library' });
            }
            inMemoryDB.likes.splice(idx, 1);
            return res.json({ message: 'Track removed from library' });
        }

        const result = await Like.findOneAndDelete({ userId, trackId });
        if (!result) {
            return res.status(404).json({ error: 'Track not found in library' });
        }

        res.json({ message: 'Track removed from library' });
    } catch (e) {
        console.error('Delete track error:', e.message);
        res.status(500).json({ error: 'Failed to remove track' });
    }
});

// Library: Unfollow artist
app.delete('/api/library/artist/:artistId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { artistId } = req.params;

        if (useInMemory) {
            const idx = inMemoryDB.follows.findIndex(f => f.userId === userId && f.artistId === artistId);
            if (idx === -1) {
                return res.status(404).json({ error: 'Artist not followed' });
            }
            inMemoryDB.follows.splice(idx, 1);
            return res.json({ message: 'Artist unfollowed' });
        }

        const result = await Follow.findOneAndDelete({ userId, artistId });
        if (!result) {
            return res.status(404).json({ error: 'Artist not followed' });
        }

        res.json({ message: 'Artist unfollowed' });
    } catch (e) {
        console.error('Unfollow artist error:', e.message);
        res.status(500).json({ error: 'Failed to unfollow artist' });
    }
});

// Enhanced Search: Returns isArchived status for each track
app.get('/api/search/enhanced', authenticateToken, userLimiter, async (req, res) => {
    try {
        const { q, type = 'track' } = req.query;
        const limit = Math.min(10, Math.max(1, parseInt(req.query.limit) || 10));
        const userId = req.user.id;

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const token = await getSpotifyToken();
        const searchResp = await axios.get(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`,
            { headers: { 'Authorization': `Bearer ${token}` }, timeout: 10000 }
        );

        // Get user's liked track IDs for comparison
        let userLikedTrackIds = [];
        if (useInMemory) {
            userLikedTrackIds = inMemoryDB.likes
                .filter(l => l.userId === userId)
                .map(l => l.trackId);
        } else {
            const userLikes = await Like.find({ userId }).select('trackId').lean();
            userLikedTrackIds = userLikes.map(l => l.trackId);
        }

        if (type === 'track') {
            const tracks = searchResp.data.tracks.items.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artists[0]?.name || 'Unknown',
                artistId: t.artists[0]?.id,
                album: t.album.name,
                albumId: t.album.id,
                image: t.album.images[0]?.url,
                preview_url: t.preview_url,
                duration_ms: t.duration_ms,
                popularity: t.popularity,
                external_url: t.external_urls?.spotify,
                isArchived: userLikedTrackIds.includes(t.id) // ⭐ Key feature
            }));

            // Enrich with iTunes previews if needed
            const enrichedTracks = await enrichTracksWithPreviews(tracks);

            return res.json({
                tracks: enrichedTracks,
                total: searchResp.data.tracks.total
            });
        }

        // For artist/album searches, return as-is
        res.json(searchResp.data);
    } catch (e) {
        console.error('Enhanced search error:', e.message);
        return sendSpotifyError(res, e);
    }
});

// ============================================
// 📚 MOBILE LIBRARY API - For React Native App
// ============================================
// These endpoints power the mobile app's library functionality
// In production: requires valid JWT token
// In development: allows mock user fallback for testing

// 🔧 Mobile Auth Middleware (production-safe with dev fallback)


// 🟢 POST /api/library/like - Archive/Like a song

// 🔴 DELETE /api/library/track/:spotifyId - Remove a song from library

// 👥 POST /api/library/follow - Follow an artist

// 📝 POST /api/library/note - Add/Update a memory note to a track
app.post('/api/library/note', authenticateToken, async (req, res) => {
    try {
        const { spotifyId, note } = req.body;

        if (typeof spotifyId !== 'string' || !spotifyId.trim()) {
            return res.status(400).json({ success: false, error: 'spotifyId is required' });
        }
        if (note !== undefined && note !== null && typeof note !== 'string') {
            return res.status(400).json({ success: false, error: 'note must be a string or null' });
        }

        if (useInMemory) {
            const track = inMemoryDB.likes.find(
                l => l.userId === req.user.id && l.trackId === spotifyId
            );

            if (!track) {
                return res.status(404).json({ success: false, error: 'Track not in library' });
            }

            track.userNote = note || null;
            track.noteUpdatedAt = new Date();

            return res.json({
                success: true,
                message: note ? 'Memory tag added' : 'Memory tag removed',
                note: track.userNote,
                noteUpdatedAt: track.noteUpdatedAt
            });
        }

        // MongoDB
        const result = await Like.findOneAndUpdate(
            { userId: req.user.id, trackId: spotifyId },
            { $set: { userNote: note || null, noteUpdatedAt: new Date() } },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ success: false, error: 'Track not in library' });
        }

        console.log(`📚 Library: Note updated for track ${spotifyId}`);

        res.json({
            success: true,
            message: note ? 'Memory tag added' : 'Memory tag removed',
            note: result.userNote,
            noteUpdatedAt: result.noteUpdatedAt
        });
    } catch (e) {
        console.error('Library note error:', e.message);
        res.status(500).json({ success: false, error: 'Failed to update note' });
    }
});

// 🔄 POST /api/library/enrich-previews - Enrich old likes with missing preview URLs - Rate limited
app.post('/api/library/enrich-previews', authenticateToken, userLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        let enrichedCount = 0;
        let failedCount = 0;
        let alreadyHadPreview = 0;

        if (useInMemory) {
            const userLikes = inMemoryDB.likes.filter(l => l.userId === userId);

            for (const like of userLikes) {
                // Skip if already has valid preview URL
                if (like.previewUrl &&
                    like.previewUrl !== 'undefined' &&
                    like.previewUrl !== 'null' &&
                    like.previewUrl.startsWith('https://')) {
                    alreadyHadPreview++;
                    continue;
                }

                // Get preview from iTunes
                try {
                    const result = await getAudioPreview(like.trackName, like.artistName || 'Unknown');
                    if (result.url) {
                        like.previewUrl = result.url;
                        enrichedCount++;
                    } else {
                        failedCount++;
                    }
                } catch (err) {
                    failedCount++;
                }

                // Rate limit: 100ms delay between iTunes calls
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return res.json({
                success: true,
                message: `Enrichment complete`,
                stats: {
                    total: userLikes.length,
                    enriched: enrichedCount,
                    failed: failedCount,
                    alreadyHadPreview: alreadyHadPreview
                }
            });
        }

        // MongoDB: Get all likes without valid preview URLs
        const likesWithoutPreviews = await Like.find({
            userId,
            $or: [
                { previewUrl: { $exists: false } },
                { previewUrl: null },
                { previewUrl: '' },
                { previewUrl: 'undefined' },
                { previewUrl: 'null' }
            ]
        }).lean();

        const totalLikes = await Like.countDocuments({ userId });
        alreadyHadPreview = totalLikes - likesWithoutPreviews.length;

        console.log(`🔄 Enriching ${likesWithoutPreviews.length} tracks for user ${req.user.username || userId}`);

        // Process in batches to avoid rate limiting
        const batchSize = 5;
        for (let i = 0; i < likesWithoutPreviews.length; i += batchSize) {
            const batch = likesWithoutPreviews.slice(i, i + batchSize);

            await Promise.all(batch.map(async (like) => {
                try {
                    const result = await getAudioPreview(like.trackName, like.artistName || 'Unknown');
                    if (result.url) {
                        await Like.updateOne(
                            { _id: like._id },
                            { $set: { previewUrl: result.url } }
                        );
                        enrichedCount++;
                    } else {
                        failedCount++;
                    }
                } catch (err) {
                    console.error(`Failed to enrich ${like.trackName}:`, err.message);
                    failedCount++;
                }
            }));

            // Small delay between batches
            if (i + batchSize < likesWithoutPreviews.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`✅ Enrichment complete: ${enrichedCount} enriched, ${failedCount} failed`);

        res.json({
            success: true,
            message: `Enrichment complete`,
            stats: {
                total: totalLikes,
                enriched: enrichedCount,
                failed: failedCount,
                alreadyHadPreview: alreadyHadPreview
            }
        });
    } catch (e) {
        console.error('Enrich previews error:', e.message);
        res.status(500).json({ success: false, error: 'Failed to enrich previews' });
    }
});

// 📊 GET /api/library/stats - Get library statistics
app.get('/api/library/stats', authenticateToken, async (req, res) => {
    try {
        if (useInMemory) {
            const tracks = inMemoryDB.likes.filter(l => l.userId === req.user.id);
            const follows = inMemoryDB.follows.filter(f => f.userId === req.user.id);
            const albums = inMemoryDB.albumFollows?.filter(a => a.userId === req.user.id) || [];

            // Get unique artists from tracks
            const uniqueArtists = new Set(tracks.map(t => t.artistName).filter(Boolean));

            return res.json({
                success: true,
                stats: {
                    totalTracks: tracks.length,
                    totalFollowedArtists: follows.length,
                    totalSavedAlbums: albums.length,
                    uniqueArtistsInLibrary: uniqueArtists.size,
                    tracksWithNotes: tracks.filter(t => t.userNote).length,
                    digModeTracks: tracks.filter(t => t.source === 'dig').length,
                    manualTracks: tracks.filter(t => t.source === 'manual' || !t.source).length
                }
            });
        }

        // MongoDB
        const userId = req.user.id;
        const [trackCount, followCount, albumCount, tracksWithNotes, digTracks] = await Promise.all([
            Like.countDocuments({ userId }),
            Follow.countDocuments({ userId }),
            AlbumFollow.countDocuments({ userId }),
            Like.countDocuments({ userId, userNote: { $ne: null } }),
            Like.countDocuments({ userId, source: 'dig' })
        ]);

        const uniqueArtists = await Like.distinct('artistName', { userId });

        res.json({
            success: true,
            stats: {
                totalTracks: trackCount,
                totalFollowedArtists: followCount,
                totalSavedAlbums: albumCount,
                uniqueArtistsInLibrary: uniqueArtists.length,
                tracksWithNotes: tracksWithNotes,
                digModeTracks: digTracks,
                manualTracks: trackCount - digTracks
            }
        });
    } catch (e) {
        console.error('Library stats error:', e.message);
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

// 📋 GET /api/library/tracks - Get all tracks in library (with pagination)

// 👥 GET /api/library/artists - Get all followed artists

// 🔍 GET /api/library/check/:spotifyId - Check if a track is in library
app.get('/api/library/check/:spotifyId', authenticateToken, async (req, res) => {
    try {
        const { spotifyId } = req.params;

        if (useInMemory) {
            const exists = inMemoryDB.likes.some(
                l => l.userId === req.user.id && l.trackId === spotifyId
            );
            return res.json({ success: true, inLibrary: exists, spotifyId });
        }

        const exists = await Like.findOne({ userId: req.user.id, trackId: spotifyId });
        res.json({ success: true, inLibrary: !!exists, spotifyId });
    } catch (e) {
        console.error('Library check error:', e.message);
        res.status(500).json({ success: false, error: 'Failed to check library' });
    }
});

// 📱 MOBILE: Bind to 0.0.0.0 for local network access (React Native Expo)
const HOST = process.env.HOST || '0.0.0.0';

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Convert expected request failures to stable JSON without exposing stack traces.
app.use((err, req, res, next) => {
    if (err?.code === 'CORS_NOT_ALLOWED') {
        return res.status(403).json({ error: 'Origin not allowed' });
    }
    console.error('Unhandled request error:', err?.message || err);
    return res.status(err?.status || 500).json({ error: 'Internal server error' });
});

const startServer = async () => {
    await connectDatabase();
    return app.listen(PORT, HOST, () => {
        console.log(`🚀 Server running on http://${HOST}:${PORT}`);
        console.log(`📱 Mobile access: Use your computer's IP address instead of localhost`);
        console.log(`🔒 Admin panel: http://localhost:${PORT}/admin`);
        console.log(`📊 Admin API: /api/admin/users, /api/admin/stats`);
        console.log(`📚 Library API: /api/library/like, /api/library/track/:id, /api/library/follow, /api/library/note`);
    });
};

if (require.main === module) {
    startServer().catch((err) => {
        console.error('❌ FATAL: Server startup failed:', err.message);
        process.exitCode = 1;
    });
}

module.exports = {
    app,
    connectDatabase,
    startServer,
    ...(process.env.NODE_ENV === 'test' ? {
        _test: {
            inMemoryDB,
            models: { User, Like, Rating, LoginHistory },
            timingSafeStringEqual,
            toggleLike,
            upsertLike
        }
    } : {})
};

