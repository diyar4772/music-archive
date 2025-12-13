# 🎵 Music Archive

A modern music library web application with Spotify integration, user authentication, and personalized playlists.

## Features

- 🔍 **Search Artists & Tracks** - Powered by Spotify API
- ❤️ **Like Songs** - Save your favorite tracks
- 👤 **Follow Artists** - Keep track of your favorite artists
- 💿 **Follow Albums** - Save albums to your library
- 📝 **Create Playlists** - Build custom playlists
- 🌙 **Dark/Light Theme** - Customizable UI
- 🌍 **Multi-language** - Turkish, English, Kurdish support

## Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT + bcrypt
- **API**: Spotify Web API

## Deployment (Render.com)

### Prerequisites
1. [MongoDB Atlas](https://www.mongodb.com/atlas) free cluster
2. [Spotify Developer](https://developer.spotify.com/dashboard) app credentials
3. [Render.com](https://render.com) account

### Environment Variables
Set these in Render Dashboard → Your Service → Environment:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `JWT_SECRET` | Random secret string for JWT |

### Deploy Steps
1. Push code to GitHub
2. Create new **Web Service** on Render
3. Connect your GitHub repo
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm start`
6. Add environment variables
7. Deploy!

## Local Development

```bash
# Clone repository
git clone https://github.com/diyar4772/music-archive.git
cd music-archive

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | ❌ | Create account |
| POST | `/api/login` | ❌ | Login |
| GET | `/api/search` | ❌ | Search artists/tracks |
| GET | `/api/album/:id` | ❌ | Get album details |
| GET | `/api/me` | ✅ | Get user data |
| POST | `/api/follow` | ✅ | Follow/unfollow artist |
| POST | `/api/like` | ✅ | Like/unlike track |
| POST | `/api/follow-album` | ✅ | Follow/unfollow album |
| GET | `/api/playlists` | ✅ | Get user playlists |
| POST | `/api/playlists` | ✅ | Create playlist |
| POST | `/api/playlists/:id/add` | ✅ | Add track to playlist |
| DELETE | `/api/playlists/:id` | ✅ | Delete playlist |
| DELETE | `/api/playlists/:id/tracks/:trackId` | ✅ | Remove track |

## License

MIT License - See [LICENSE](LICENSE) file
