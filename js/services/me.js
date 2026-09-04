// Current-user snapshot service.
//
// The backend exposes one aggregate endpoint, GET /api/me, that returns follows,
// likes, albumFollows and ratings together. The library and rating services used
// to ask for /likes, /follows and /ratings instead — endpoints that do not exist,
// so every read 404'd and the library always looked empty.
//
// Requests are de-duplicated while one is in flight so the parallel loaders in
// fetchUserData() cost a single round trip instead of three.
import { get } from './api.js';

const EMPTY = { follows: [], likes: [], albumFollows: [], ratings: [] };

let inFlight = null;

/**
 * Fetch the current user's library snapshot.
 * @param {{force?: boolean}} [options] - force skips an in-flight request reuse
 * @returns {Promise<{follows: Array, likes: Array, albumFollows: Array, ratings: Array}>}
 */
export function fetchMe({ force = false } = {}) {
    if (inFlight && !force) return inFlight;

    inFlight = get('/me')
        .then(data => ({ ...EMPTY, ...data }))
        .finally(() => { inFlight = null; });

    return inFlight;
}
