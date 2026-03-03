// dropbox-db.js
// Модуль для роботи з data.json у Dropbox як з базою даних.
// Замінює: auth.js, songs-library.js, playlists.js
//
// ┌─────────────────────────────────────────────────────┐
// │  НАЛАШТУВАННЯ — заповніть перед використанням       │
// └─────────────────────────────────────────────────────┘

const DROPBOX_TOKEN     = 'sl.u.AGWhfWwr7dHNn_Gl-vP9-6kvayoVPBogkuyYHSGA-HDClkqXTHQtyWGMM48nBtQEfsY3uTmHp-K4mu6WcW-dT7xEaipK7eEgoNRiFWmycaJyRIjkCSQfH2OAlU4dZfa5tzgsfKN41mmULB0WGKtajVknQtetycKx_Hx6zOtc0dlsz_7c5ZIdOql6VYB7fJZTyPpvlbMniTY7uqfzSZAWWXEcYjRf5XuOHecGxlFLHzfx1XaqlFQFJ9PQcdf_iz9fovxP6L5Tg8R_xY1n1JMYoJYD-XgYHOcdnBdT45rONSxUvmKOLkiIr1U4pOYpYZZvhF5mttyd_ezjO1wlbeFKCLZngj2hY47PnM_wvzdr75b7m2-k0XqXvIqoKG4bfyn5kINkAQ8Xv2f4BHgpeDTREOx7TB70F33kE0NQBZAr4PN66pgvyXUDhV5ohVKGltAhIY16q4FZ6dDxQPrz9vwHunfv0wplyAdFH4FAcFEHNV88JZDJeLqBSNfYuJr_aNBCpSeXdUT3JrAlA5F6TPfSvlciDaJCs6qjyUiY8VqwqmJcBBcqU_UYqqcK2DknK4-Vem1sTC8qKJXHFk9SNXafPyY7gIltgttByf1eW-vxo6Tw_Rf6e1vLwm3N7DRGQ7zNxXicm-uKwqbSVUFbinUbgewIklZjsobp9eIA6N7IHn7KKdX3Lrh1fzyH6efyZflhuwev7SQ99qGu2JGnsD5qWMOZwMJuDbx-a8mPPVbZ0bmFycxOgS2Vt-jzP8FuWBGbl-b18KUgmB-gMOk67UdLtC-s6mDOrQtROFk9G6eCjtXyLAIQoJYSfaXGU2oZO2NLJoZcAJBZbCl_UYgzDB-5WPXCvrTO7h4t2uuJWTwEjq09-r4eIwC76PZt6GSEkqWa_EvJgpkdtv3uF3ThjXTiGG9Xkr1suQCunjEuefuY0YqaOQSYeaOuVYNWzpJccPDssi3uLfx0MrKtnqe1lFnyA4S3It7kqbWV_xQpsPtt85iX5DxA4u01Qvx_ORf7taJNdjuk4iuw21kaZxS2BQEzeuZUS3AIVKoYcK6LVHg-a-sbiha1HgO9K2LFGnBktmf1KuJwfkuyZFXulFz13ZXgY9Jhos1kMw82PQEY2OFWCtqyinEOHLl2HWn4SQeTeoSt2cJZkWePURriyZEorDCLLKSdnQsGb5vxbEZD8HbYnhwHZunZFfqG8x4d6b0Qm1YG6thBIdIGR_CA7-1ncNvDWwJh0BIcR7Ff7_0aZFYQYCArOgYQhNEy6Fvr6hRkPJ3HHFa8Ss1V5FyM2igVch-INAFFBR_IJbQb_DNizzH27BtbjACXaQydohsyzwX_B15pLdzZgaN1ngPlo5-0HP3EJQaZADS82YfBJByV5j1a1pCMgujsWmI3hjxJc7fMcrI-OtKFEcrBNL7i1CKE_vQShvduhdHYk8w6ToUkWfLkjfF0p8H6XfpAJutsTMj5ePa2ZsW9vcC9RU-st5xdKCoVlirJ'; // згенерувати на dropbox.com/developers
const DROPBOX_FILE_PATH = '/data.json';               // шлях до файлу в Dropbox

// ══════════════════════════════════════════════════════
// ВНУТРІШНІ ФУНКЦІЇ DROPBOX API
// ══════════════════════════════════════════════════════

// Порожня структура БД — використовується коли файл ще не існує
const EMPTY_DB = () => ({ users: [], songs: [], playlists: [] });

// Читає data.json з Dropbox.
// Якщо файл не існує (помилка 400/409) — автоматично створює його.
async function dbRead() {
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
            'Authorization':   `Bearer ${DROPBOX_TOKEN}`,
            'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_FILE_PATH })
        }
    });

    // Файл не знайдено — створити порожній і повернути порожню структуру
    if (!res.ok) {
        const rawText = await res.text().catch(() => '');
        const isNotFound = rawText.includes('not_found') ||
                           rawText.includes('path/not_found') ||
                           res.status === 400 ||
                           res.status === 409;

        if (isNotFound) {
            console.log('[DB] data.json не знайдено — створюємо...');
            const empty = EMPTY_DB();
            await dbWrite(empty);
            console.log('[DB] data.json створено успішно');
            return empty;
        }

        throw new Error(`Dropbox read error ${res.status}: ${rawText.slice(0, 300)}`);
    }

    const text = await res.text();
    try {
        const parsed = JSON.parse(text);
        // Гарантувати наявність всіх полів
        if (!Array.isArray(parsed.users))     parsed.users     = [];
        if (!Array.isArray(parsed.songs))     parsed.songs     = [];
        if (!Array.isArray(parsed.playlists)) parsed.playlists = [];
        return parsed;
    } catch {
        // Файл пошкоджений — скинути до порожнього
        console.warn('[DB] data.json пошкоджений — скидаємо');
        const empty = EMPTY_DB();
        await dbWrite(empty);
        return empty;
    }
}

// Записує об'єкт у data.json на Dropbox (перезаписує повністю)
async function dbWrite(data) {
    const body = JSON.stringify(data, null, 2);

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
            'Authorization':   `Bearer ${DROPBOX_TOKEN}`,
            'Dropbox-API-Arg': JSON.stringify({
                path: DROPBOX_FILE_PATH,
                mode: 'overwrite',   // завжди перезаписувати
                mute: true           // не надсилати сповіщення
            }),
            'Content-Type': 'application/octet-stream'
        },
        body
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error('Dropbox write error: ' + (err?.error_summary || res.status));
    }

    return await res.json();
}

// Атомарна операція: прочитати → змінити → записати
// Захищає від часткових записів при помилці
async function dbTransaction(fn) {
    const data = await dbRead();
    const updated = await fn(data);      // fn змінює data і повертає результат
    await dbWrite(data);                 // записати змінений data назад
    return updated;
}

// ══════════════════════════════════════════════════════
// ХЕШУВАННЯ ПАРОЛЯ (Web Crypto API, без бібліотек)
// ══════════════════════════════════════════════════════

async function hashPassword(password) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════════════
// ГЕНЕРАТОРИ ID
// ══════════════════════════════════════════════════════

function generateProfileId() {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function generatePlaylistId() {
    return 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// Найменший вільний числовий ID (повторно використовує ID видалених пісень)
function getNextSongId(songs) {
    const used = new Set(songs.map(s => s.id));
    let id = 1;
    while (used.has(id)) id++;
    return id;
}

// ══════════════════════════════════════════════════════
// СЕСІЯ (тільки в localStorage, без пароля)
// ══════════════════════════════════════════════════════

function getSession()    { return JSON.parse(localStorage.getItem('session') || 'null'); }
function saveSession(u)  { localStorage.setItem('session', JSON.stringify(u)); }
function clearSession()  { localStorage.removeItem('session'); }

// ══════════════════════════════════════════════════════
// ПУБЛІЧНИЙ МОДУЛЬ DB
// ══════════════════════════════════════════════════════

const DB = (() => {

    // ── AUTH ─────────────────────────────────────────

    async function register(name, login, password) {
        if (!name || !login || !password)
            return { ok: false, error: 'Заповніть всі поля' };
        if (password.length < 4)
            return { ok: false, error: 'Пароль мінімум 4 символи' };

        try {
            const user = await dbTransaction(async (data) => {
                if (data.users.find(u => u.login === login))
                    throw new Error('Логін вже зайнятий');

                const profileId    = generateProfileId();
                const passwordHash = await hashPassword(password);
                const newUser      = { profileId, name, login, passwordHash };

                data.users.push(newUser);
                return { profileId, name, login }; // повернути без пароля
            });

            saveSession(user);
            return { ok: true, user };

        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    async function loginUser(login, password) {
        if (!login || !password)
            return { ok: false, error: 'Заповніть всі поля' };

        try {
            const data = await dbRead();
            const u    = data.users.find(u => u.login === login);

            if (!u) return { ok: false, error: 'Користувача не знайдено' };

            const hash = await hashPassword(password);
            if (u.passwordHash !== hash)
                return { ok: false, error: 'Невірний пароль' };

            const user = { profileId: u.profileId, name: u.name, login: u.login };
            saveSession(user);
            return { ok: true, user };

        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    function logout() { clearSession(); }

    // ── SONGS ─────────────────────────────────────────

    async function getSongs() {
        const data = await dbRead();
        return data.songs;
    }

    async function addSong({ nameSong, songURL, previewURL, profileId }) {
        return await dbTransaction((data) => {
            const id        = getNextSongId(data.songs);
            const dateUpdate = new Date().toISOString().slice(0, 10);
            const song       = { id, nameSong, songURL, previewURL, dateUpdate, profileId };

            data.songs.push(song);
            data.songs.sort((a, b) => a.id - b.id);
            return song;
        });
    }

    async function deleteSong(songId, profileId) {
        return await dbTransaction((data) => {
            const song = data.songs.find(s => s.id === songId);
            if (!song)                        throw new Error('Пісню не знайдено');
            if (song.profileId !== profileId) throw new Error('Можна видаляти тільки свої пісні');

            // Видалити з бібліотеки
            data.songs = data.songs.filter(s => s.id !== songId);

            // Видалити з усіх плейлистів
            data.playlists.forEach(pl => {
                pl.songIDs = pl.songIDs.filter(id => id !== songId);
            });

            return { ok: true };
        });
    }

    // ── PLAYLISTS ─────────────────────────────────────

    async function getPlaylists(profileId) {
        const data = await dbRead();
        return data.playlists.filter(p => p.profileId === profileId);
    }

    async function createPlaylist(name, profileId) {
        return await dbTransaction((data) => {
            const pl = {
                id: generatePlaylistId(),
                name,
                profileId,
                songIDs: []
            };
            data.playlists.push(pl);
            return pl;
        });
    }

    async function deletePlaylist(playlistId, profileId) {
        return await dbTransaction((data) => {
            const pl = data.playlists.find(p => p.id === playlistId);
            if (!pl)                        throw new Error('Плейлист не знайдено');
            if (pl.profileId !== profileId) throw new Error('Не ваш плейлист');

            data.playlists = data.playlists.filter(p => p.id !== playlistId);
            return { ok: true };
        });
    }

    async function addSongToPlaylist(playlistId, songId, profileId) {
        return await dbTransaction((data) => {
            const pl = data.playlists.find(p => p.id === playlistId);
            if (!pl)                        throw new Error('Плейлист не знайдено');
            if (pl.profileId !== profileId) throw new Error('Не ваш плейлист');
            if (pl.songIDs.includes(songId)) return { ok: false, already: true };

            pl.songIDs.push(songId);
            return { ok: true };
        });
    }

    async function removeSongFromPlaylist(playlistId, songId, profileId) {
        return await dbTransaction((data) => {
            const pl = data.playlists.find(p => p.id === playlistId);
            if (!pl)                        throw new Error('Плейлист не знайдено');
            if (pl.profileId !== profileId) throw new Error('Не ваш плейлист');

            pl.songIDs = pl.songIDs.filter(id => id !== songId);
            return { ok: true };
        });
    }

    return {
        // Auth
        register, loginUser, logout, getSession,
        // Songs
        getSongs, addSong, deleteSong,
        // Playlists
        getPlaylists, createPlaylist, deletePlaylist,
        addSongToPlaylist, removeSongFromPlaylist,
    };
})();
