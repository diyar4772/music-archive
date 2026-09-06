import { post, get } from '../services/api.js';
import { store } from '../state/store.js';

const failure = translationKey => Object.assign(new Error(translationKey), { translationKey });
let database;
export function currentOwner() {
    try { return JSON.parse(atob(store.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id || null; }
    catch { return null; }
}

function openDatabase() {
    if (!database) {database = new Promise((resolve, reject) => {
        const request = indexedDB.open('music-archive-recordings', 1);
        request.onupgradeneeded = () => {
            const drafts = request.result.createObjectStore('drafts', { keyPath: ['owner', 'id'] });
            drafts.createIndex('owner', 'owner');
        };
        request.onsuccess = () => {
            request.result.onversionchange = () => { request.result.close(); database = null; };
            resolve(request.result);
        };
        request.onerror = () => { database = null; reject(request.error); };
        request.onblocked = () => { database = null; reject(failure('states.storageDenied')); };
    });}
    return database;
}

async function transaction(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', mode);
        const request = action(tx.objectStore('drafts'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error || failure('studio.checkpointFailed'));
        tx.onabort = () => reject(tx.error || failure('studio.checkpointFailed'));
    });
}

export function saveDraft(recording, owner, state = 'local') {
    if (!owner) return Promise.reject(failure('states.signedOutBody'));
    return transaction('readwrite', drafts => drafts.put({ ...recording, owner, state, updatedAt: new Date().toISOString() }));
}

export async function listDrafts(owner = currentOwner()) {
    if (!owner) return [];
    return (await transaction('readonly', drafts => drafts.index('owner').getAll(owner)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteDraft(id, owner) {
    return transaction('readwrite', drafts => drafts.delete([owner, id]));
}

export async function uploadRecording(recording, owner) {
    if (currentOwner() !== owner) throw failure('states.signedOutBody');
    // Persist before the first network request; a failed/ambiguous POST is safe
    // to retry because the server enforces (owner, client UUID) idempotency.
    await saveDraft(recording, owner, 'local');
    try {
        const { id, title, description, tags, input, source, instrument, durationMs, events, pieceId, takeGroupId } = recording;
        const result = await post('/recordings', { id, title, description, tags, input, source, instrument, durationMs, events, pieceId, takeGroupId },
            { signal: AbortSignal.timeout(30000) });
        if (!result.stored || result.recording?.id !== id) throw failure('states.errorGeneric');
        await deleteDraft(id, owner);
        return result.recording;
    } catch (error) {
        await saveDraft(recording, owner, 'failed').catch(() => {});
        throw error;
    }
}

export const listRecordings = (offset = 0) => get(`/recordings?offset=${offset}`);
export const getRecording = id => get(`/recordings/${encodeURIComponent(id)}`).then(r => r.recording);
export const listPieces = () => get('/pieces').then(r => r.pieces);
export const createPiece = values => post('/pieces', { ...values, id: crypto.randomUUID() }).then(r => r.piece);
