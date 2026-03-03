// songs-library.js
// Єдина бібліотека пісень: стартує з Songs.js, всі зміни — в localStorage
// Структура пісні: { id, nameSong, songURL, previewURL, dateUpdate, profileID }

const SongsLib = (() => {

    const KEY = 'songsLibrary';

    // ── Ініціалізація: якщо localStorage порожній — завантажуємо Songs.js ──
    function init() {
        if (!localStorage.getItem(KEY)) {
            localStorage.setItem(KEY, JSON.stringify(SONGS));
        }
    }

    function getAll() {
        init();
        return JSON.parse(localStorage.getItem(KEY) || '[]');
    }

    function saveAll(songs) {
        localStorage.setItem(KEY, JSON.stringify(songs));
    }

    // ── Знайти найменший вільний ID (повторно використовує видалені) ────────
    function getNextID(songs) {
        const usedIDs = new Set(songs.map(s => s.id));
        let id = 1;
        while (usedIDs.has(id)) id++;
        return id;
    }

    // ── Додати пісню ─────────────────────────────────────────────────────────
    function add({ nameSong, songURL, previewURL, profileID }) {
        const songs = getAll();
        const id = getNextID(songs);
        const dateUpdate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const newSong = { id, nameSong, songURL, previewURL, dateUpdate, profileID };
        songs.push(newSong);
        // Сортуємо по id щоб список завжди йшов по порядку
        songs.sort((a, b) => a.id - b.id);
        saveAll(songs);
        return newSong;
    }

    // ── Видалити пісню по id ─────────────────────────────────────────────────
    function remove(id) {
        saveAll(getAll().filter(s => s.id !== id));
    }

    // ── Знайти пісню ─────────────────────────────────────────────────────────
    function getByID(id) {
        return getAll().find(s => s.id === id) || null;
    }

    return { init, getAll, add, remove, getByID, getNextID };
})();
