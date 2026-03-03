// playlists.js
// Структура: { id, name, profileID, songIDs: [songId, ...] }

const Playlists = (() => {
    function getAll()       { return JSON.parse(localStorage.getItem('playlists') || '[]'); }
    function saveAll(pls)   { localStorage.setItem('playlists', JSON.stringify(pls)); }

    function getByProfile(profileID) { return getAll().filter(p => p.profileID === profileID); }

    function create(name, profileID) {
        const pls = getAll();
        const pl = { id:'pl_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name, profileID, songIDs:[] };
        pls.push(pl);
        saveAll(pls);
        return pl;
    }

    function addSong(playlistID, songID) {
        const pls = getAll();
        const pl = pls.find(p => p.id === playlistID);
        if (!pl || pl.songIDs.includes(songID)) return false;
        pl.songIDs.push(songID);
        saveAll(pls);
        return true;
    }

    function removeSong(playlistID, songID) {
        const pls = getAll();
        const pl = pls.find(p => p.id === playlistID);
        if (!pl) return;
        pl.songIDs = pl.songIDs.filter(id => id !== songID);
        saveAll(pls);
    }

    // При видаленні пісні з бібліотеки — прибрати її з усіх плейлистів
    function purgeSong(songID) {
        const pls = getAll().map(pl => ({ ...pl, songIDs: pl.songIDs.filter(id => id !== songID) }));
        saveAll(pls);
    }

    function remove(playlistID) { saveAll(getAll().filter(p => p.id !== playlistID)); }

    function getSongs(playlistID) {
        const pl = getAll().find(p => p.id === playlistID);
        if (!pl) return [];
        return pl.songIDs.map(id => SongsLib.getByID(id)).filter(Boolean);
    }

    return { getAll, getByProfile, create, addSong, removeSong, purgeSong, remove, getSongs };
})();
