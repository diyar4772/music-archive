/**
 * One-off migration: carry the old single note into the Müzik Defteri.
 *
 * Before the journal, a track held one `Like.userNote` that every save
 * overwrote. Those sentences are the oldest entries a user has, so they become
 * the first entry of that track's journal, dated from `noteUpdatedAt` — not
 * from today, which would claim the note was written now.
 *
 * The original `userNote` is left in place: the mobile client still reads it,
 * and nothing is destroyed by a migration that only adds.
 *
 * Safe to run twice — a note that already has an entry with the same text is
 * skipped, so a repeat run reports 0 copied rather than duplicating history.
 *
 *   MONGO_URI=mongodb://127.0.0.1:27017/music_archive node scripts/migrate-notes.mjs
 *   ... --dry-run   to count without writing
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JournalEntry } = require('../server/journal.js');

if (process.env.SKIP_DOTENV_CONFIG !== 'true') dotenv.config();

const dryRun = process.argv.includes('--dry-run');
const uri = process.env.MONGO_URI;

if (!uri) {
    console.error('MONGO_URI is required. The in-memory store holds nothing to migrate.');
    process.exit(1);
}

// Read the archive rows directly: server.js owns the Like model, and loading it
// would start the whole application.
const likeSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId, trackId: String, trackName: String,
    artistName: String, image: String, userNote: String, noteUpdatedAt: Date
}, { timestamps: true, collection: 'likes' });
const Like = mongoose.model('MigrationLike', likeSchema);

const ratingSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId, itemId: String, itemType: String, rating: Number
}, { timestamps: true, collection: 'ratings' });
const Rating = mongoose.model('MigrationRating', ratingSchema);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

const rows = await Like.find({ userNote: { $nin: [null, ''] } }).lean();
let copied = 0, skipped = 0;

for (const row of rows) {
    const body = String(row.userNote).trim();
    if (!body) { skipped += 1; continue; }

    const already = await JournalEntry.exists({ userId: row.userId, trackId: row.trackId, body });
    if (already) { skipped += 1; continue; }

    if (dryRun) { copied += 1; continue; }

    const rating = await Rating.findOne({ userId: row.userId, itemId: row.trackId, itemType: 'track' }).lean();
    const written = row.noteUpdatedAt || row.updatedAt || row.createdAt || new Date();

    const entry = new JournalEntry({
        userId: row.userId,
        trackId: row.trackId,
        trackName: row.trackName || '',
        artistName: row.artistName || '',
        image: row.image || null,
        body,
        rating: rating ? rating.rating : null,
        // The entry is dated from the note, not from the migration, so
        // automatic timestamps are switched off for this write.
        createdAt: written,
        updatedAt: written
    });
    await entry.save({ timestamps: false });
    copied += 1;
}

console.log(`${dryRun ? '[dry run] ' : ''}notes found: ${rows.length} · copied: ${copied} · already present: ${skipped}`);
await mongoose.disconnect();
