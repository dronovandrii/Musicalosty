// supabase-db.js
// Замінює firebase-db.js — використовує Supabase REST API напряму (без npm)

const SUPABASE_URL = 'https://qrvdgsewwztbenpyudda.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydmRnc2V3d3p0YmVucHl1ZGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDY0MTEsImV4cCI6MjA4ODIyMjQxMX0.n8HIIDusXEP51wdPyH4vJILFgnQURF_JNK6tXjzb1lo';

// ══════════════════════════════════════════════════════
// БАЗОВИЙ FETCH ДО SUPABASE REST API
// ══════════════════════════════════════════════════════

async function sbFetch(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        'return=representation',
            ...(options.headers || {})
        }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.details || `HTTP ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
}

// ══════════════════════════════════════════════════════
// ДОПОМІЖНІ ФУНКЦІЇ
// ══════════════════════════════════════════════════════

async function hashPassword(password) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getSession()   { return JSON.parse(localStorage.getItem('session') || 'null'); }
function saveSession(u) { localStorage.setItem('session', JSON.stringify(u)); }
function clearSession() { localStorage.removeItem('session'); }

function convertDropboxUrl(url) {
    if (!url || !url.includes('dropbox.com')) return url;
    if (url.includes('raw=1') || url.includes('dl=1')) return url;
    return url.includes('?') ? url.replace('dl=0','dl=1') : url+'?dl=1';
}

// ══════════════════════════════════════════════════════
// ПУБЛІЧНИЙ МОДУЛЬ DB
// ══════════════════════════════════════════════════════

const DB = (() => {

    // ── AUTH ──────────────────────────────────────────

    async function register(name, login, password) {
        if (!name || !login || !password) return { ok:false, error:'Заповніть всі поля' };
        if (password.length < 4)          return { ok:false, error:'Пароль мінімум 4 символи' };
        try {
            // Перевірка чи логін зайнятий
            const existing = await sbFetch(`users?login=eq.${encodeURIComponent(login)}&select=id`);
            if (existing.length) return { ok:false, error:'Логін вже зайнятий' };

            const password_hash = await hashPassword(password);
            const rows = await sbFetch('users', {
                method: 'POST',
                body: JSON.stringify({ name, login, password_hash })
            });
            const user = { profileId: rows[0].id, name: rows[0].name, login: rows[0].login };
            saveSession(user);
            return { ok:true, user };
        } catch(err) { return { ok:false, error:err.message }; }
    }

    async function loginUser(login, password) {
        if (!login || !password) return { ok:false, error:'Заповніть всі поля' };
        try {
            const rows = await sbFetch(`users?login=eq.${encodeURIComponent(login)}`);
            if (!rows.length) return { ok:false, error:'Користувача не знайдено' };

            const hash = await hashPassword(password);
            if (rows[0].password_hash !== hash) return { ok:false, error:'Невірний пароль' };

            const user = { profileId: rows[0].id, name: rows[0].name, login: rows[0].login };
            saveSession(user);
            return { ok:true, user };
        } catch(err) { return { ok:false, error:err.message }; }
    }

    function logout() { clearSession(); }

    // ── SONGS ─────────────────────────────────────────

    async function getSongs() {
        const rows = await sbFetch('songs?order=id.asc');
        return rows.map(r => ({
            id:         r.id,
            nameSong:   r.name_song,
            songURL:    r.song_url,
            previewURL: r.preview_url,
            dateUpdate: r.date_update,
            profileId:  r.profile_id
        }));
    }

    async function addSong({ nameSong, songURL, previewURL, profileId }) {
        const dateUpdate = new Date().toISOString().slice(0,10);
        const rows = await sbFetch('songs', {
            method: 'POST',
            body: JSON.stringify({
                name_song:   nameSong,
                song_url:    songURL,
                preview_url: previewURL,
                date_update: dateUpdate,
                profile_id:  profileId
            })
        });
        return {
            id:         rows[0].id,
            nameSong:   rows[0].name_song,
            songURL:    rows[0].song_url,
            previewURL: rows[0].preview_url,
            dateUpdate: rows[0].date_update,
            profileId:  rows[0].profile_id
        };
    }

    async function deleteSong(songId, profileId) {
        const rows = await sbFetch(`songs?id=eq.${songId}&select=profile_id`);
        if (!rows.length) throw new Error('Пісню не знайдено');
        if (rows[0].profile_id !== profileId) throw new Error('Можна видаляти тільки свої пісні');

        await sbFetch(`songs?id=eq.${songId}`, { method: 'DELETE' });

        // Видалити пісню з усіх плейлистів
        const pls = await sbFetch(`playlists?song_ids=cs.{${songId}}`);
        for (const pl of pls) {
            const newIds = pl.song_ids.filter(id => id !== songId);
            await sbFetch(`playlists?id=eq.${pl.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ song_ids: newIds })
            });
        }
        return { ok:true };
    }

    // ── PLAYLISTS ──────────────────────────────────────

    async function getPlaylists(profileId) {
        const rows = await sbFetch(`playlists?profile_id=eq.${profileId}`);
        return rows.map(r => ({
            id:       r.id,
            name:     r.name,
            profileId: r.profile_id,
            isPublic: r.is_public,
            songIDs:  r.song_ids || []
        }));
    }

    async function getPublicPlaylists() {
        const rows = await sbFetch('playlists?is_public=eq.true');
        return rows.map(r => ({
            id:       r.id,
            name:     r.name,
            profileId: r.profile_id,
            isPublic: r.is_public,
            songIDs:  r.song_ids || []
        }));
    }

    async function createPlaylist(name, profileId, isPublic = false) {
        const rows = await sbFetch('playlists', {
            method: 'POST',
            body: JSON.stringify({
                name,
                profile_id: profileId,
                is_public:  isPublic,
                song_ids:   []
            })
        });
        return {
            id:       rows[0].id,
            name:     rows[0].name,
            profileId: rows[0].profile_id,
            isPublic: rows[0].is_public,
            songIDs:  rows[0].song_ids || []
        };
    }

    async function deletePlaylist(playlistId, profileId) {
        const rows = await sbFetch(`playlists?id=eq.${playlistId}&select=profile_id`);
        if (!rows.length) throw new Error('Плейлист не знайдено');
        if (rows[0].profile_id !== profileId) throw new Error('Не ваш плейлист');
        await sbFetch(`playlists?id=eq.${playlistId}`, { method: 'DELETE' });
        return { ok:true };
    }

    async function addSongToPlaylist(playlistId, songId, profileId) {
        const rows = await sbFetch(`playlists?id=eq.${playlistId}`);
        if (!rows.length) throw new Error('Плейлист не знайдено');
        const pl = rows[0];
        if (pl.profile_id !== profileId) throw new Error('Не ваш плейлист');
        const songIDs = pl.song_ids || [];
        if (songIDs.includes(songId)) return { ok:false, already:true };
        await sbFetch(`playlists?id=eq.${playlistId}`, {
            method: 'PATCH',
            body: JSON.stringify({ song_ids: [...songIDs, songId] })
        });
        return { ok:true };
    }

    async function removeSongFromPlaylist(playlistId, songId, profileId) {
        const rows = await sbFetch(`playlists?id=eq.${playlistId}`);
        if (!rows.length) throw new Error('Плейлист не знайдено');
        const pl = rows[0];
        if (pl.profile_id !== profileId) throw new Error('Не ваш плейлист');
        await sbFetch(`playlists?id=eq.${playlistId}`, {
            method: 'PATCH',
            body: JSON.stringify({ song_ids: pl.song_ids.filter(id => id !== songId) })
        });
        return { ok:true };
    }

    async function getUserName(profileId) {
        const rows = await sbFetch(`users?id=eq.${profileId}&select=name`);
        return rows.length ? rows[0].name : '—';
    }

    return {
        register, loginUser, logout, getSession,
        getSongs, addSong, deleteSong,
        getPlaylists, getPublicPlaylists, createPlaylist,
        deletePlaylist, addSongToPlaylist, removeSongFromPlaylist,
        getUserName,
    };
})();
