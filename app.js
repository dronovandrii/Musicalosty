// app.js — використовує DB (supabase-db.js)

// ══ СТАН ════════════════════════════════════════════════════
let isPlaying     = false;
let currentSongID = null;
let queue         = [];
let queueIdx      = -1;
let SONGS         = []; // масив пісень з Dropbox

// ══ TABS ════════════════════════════════════════════════════
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
});

function switchToTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(tabName + 'Tab')?.classList.add('active');
    if (tabName === 'Menu') renderDeleteList();
}

// ══ INIT ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

    const session = DB.getSession();
    if (!session) showAuthModal();
    else          await onLoggedIn(session);

    const audio        = document.getElementById('audio');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBar  = document.getElementById('progressBar');

    playPauseBtn.addEventListener('click', () => {
        if (!audio.src) { alert('Спочатку виберіть трек'); return; }
        if (isPlaying) { audio.pause(); playPauseBtn.textContent = '▶'; isPlaying = false; }
        else           { audio.play().catch(console.error); playPauseBtn.textContent = '⏸'; isPlaying = true; }
    });

    document.getElementById('rewind10').addEventListener('click',  () => { if (audio.src) audio.currentTime = Math.max(0, audio.currentTime - 10); });
    document.getElementById('forward10').addEventListener('click', () => { if (audio.src) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) progressBar.value = (audio.currentTime / audio.duration) * 100;
    });
    progressBar.addEventListener('input', () => {
        if (audio.duration) audio.currentTime = (progressBar.value / 100) * audio.duration;
    });
    audio.addEventListener('ended', () => {
        playPauseBtn.textContent = '▶'; isPlaying = false;
        if (queue.length && queueIdx < queue.length - 1) { queueIdx++; playSong(queue[queueIdx]); }
    });

    document.getElementById('addToPlaylistBtn').addEventListener('click', () => {
        if (!currentSongID) { alert('Спочатку виберіть пісню'); return; }
        openAddToPlaylistModal(currentSongID);
    });
    document.getElementById('closeAddModal').addEventListener('click', () => {
        document.getElementById('addToPlaylistModal').classList.add('hidden');
    });

    document.getElementById('showCreateForm').addEventListener('click', () => {
        document.getElementById('createPlForm').classList.remove('hidden');
        document.getElementById('newPlName').focus();
    });
    document.getElementById('cancelCreatePl').addEventListener('click', () => {
        document.getElementById('createPlForm').classList.add('hidden');
        document.getElementById('newPlName').value = '';
    });
    document.getElementById('confirmCreatePl').addEventListener('click', async () => {
        const name    = document.getElementById('newPlName').value.trim();
        const session = DB.getSession();
        if (!name || !session) return;
        const isPublic = document.querySelector('.visibility-btn.active')?.dataset.vis === 'public';
        await withLoading('confirmCreatePl', async () => {
            await DB.createPlaylist(name, session.profileId, isPublic);
            document.getElementById('newPlName').value = '';
            document.getElementById('createPlForm').classList.add('hidden');
            // reset toggle to private
            document.querySelectorAll('.visibility-btn').forEach(b => b.classList.toggle('active', b.dataset.vis === 'private'));
            await renderPlaylists();
        });
    });
    document.getElementById('newPlName').addEventListener('keypress', e => {
        if (e.key === 'Enter') document.getElementById('confirmCreatePl').click();
    });

    document.getElementById('backToPlaylists').addEventListener('click', () => {
        document.getElementById('plDetailView').classList.add('hidden');
        document.getElementById('plMainView').classList.remove('hidden');
    });

    document.getElementById('deleteConfirmNo').addEventListener('click', () => {
        document.getElementById('deleteConfirmModal').classList.add('hidden');
    });

    document.getElementById('addSongCover').addEventListener('input', () => {
        const url = document.getElementById('addSongCover').value.trim();
        const preview = document.getElementById('addSongPreview');
        const img     = document.getElementById('addSongPreviewImg');
        if (url) { img.src = convertDropboxUrl(url).replace('dl=1', 'raw=1'); preview.classList.remove('hidden'); }
        else     { preview.classList.add('hidden'); }
    });

    document.getElementById('addSongBtn').addEventListener('click', async () => {
        const nameSong   = document.getElementById('addSongName').value.trim();
        const songURL    = document.getElementById('addSongURL').value.trim();
        const previewURL = document.getElementById('addSongCover').value.trim();
        const statusEl   = document.getElementById('addSongStatus');
        const session    = DB.getSession();

        if (!nameSong)   { statusEl.textContent = 'Введіть назву'; statusEl.className = 'status-msg error'; return; }
        if (!songURL)    { statusEl.textContent = 'Введіть посилання на трек'; statusEl.className = 'status-msg error'; return; }
        if (!previewURL) { statusEl.textContent = 'Введіть посилання на обкладинку'; statusEl.className = 'status-msg error'; return; }

        statusEl.textContent = '⏳ Збереження в Dropbox...';
        statusEl.className   = 'status-msg';
        try {
            const newSong = await DB.addSong({ nameSong, songURL, previewURL, profileId: session.profileId });
            document.getElementById('addSongName').value  = '';
            document.getElementById('addSongURL').value   = '';
            document.getElementById('addSongCover').value = '';
            document.getElementById('addSongPreview').classList.add('hidden');
            SONGS = await DB.getSongs();
            renderList(); renderDeleteList();
            statusEl.textContent = `✅ "${newSong.nameSong}" додана з ID ${newSong.id}`;
            statusEl.className   = 'status-msg success';
        } catch (err) {
            statusEl.textContent = '❌ ' + err.message;
            statusEl.className   = 'status-msg error';
        }
    });

    document.getElementById('deleteSongSearch').addEventListener('input', renderDeleteList);

    // ── Subtabs у Discover ───────────────────────────────────
    document.querySelectorAll('.subtab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('subtab-' + btn.dataset.subtab)?.classList.add('active');
            if (btn.dataset.subtab === 'publicPlaylists') renderPublicPlaylists();
        });
    });

    // ── Видимість плейлиста (публічний/приватний) ────────────
    document.querySelectorAll('.visibility-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.visibility-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ── Назад у публічних плейлистах ────────────────────────
    document.getElementById('backToPublicPl').addEventListener('click', () => {
        document.getElementById('publicPlDetailView').classList.add('hidden');
        document.getElementById('publicPlMainView').classList.remove('hidden');
    });

    // ── Пошук публічних плейлистів ───────────────────────────
    document.getElementById('searchPublicPl').addEventListener('input', () => renderPublicPlaylists());
});

async function withLoading(btnId, fn) {
    const btn = btnId ? document.getElementById(btnId) : null;
    const orig = btn?.textContent;
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try { await fn(); } catch (err) { showToast('❌ ' + err.message); }
    finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
}

// ══ AUTH ════════════════════════════════════════════════════
function showAuthModal() { document.getElementById('authModal').classList.remove('hidden'); }
function hideAuthModal() { document.getElementById('authModal').classList.add('hidden'); }

async function onLoggedIn(user) {
    hideAuthModal();
    renderProfile(user);
    showToast('⏳ Завантаження бібліотеки...');
    try {
        SONGS = await DB.getSongs();
        renderList();
        await renderPlaylists();
        renderDeleteList();
        showToast('✅ Готово');
    } catch (err) {
        showToast('❌ ' + err.message);
    }
}

document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.auth + 'Form').classList.add('active');
    });
});

document.getElementById('loginSubmit').addEventListener('click', async () => {
    const login    = document.getElementById('loginLogin').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl  = document.getElementById('loginError');
    if (!login || !password) { errorEl.textContent = 'Заповніть всі поля'; return; }
    errorEl.textContent = '⏳ Вхід...';
    const res = await DB.loginUser(login, password);
    if (res.ok) await onLoggedIn(res.user);
    else        errorEl.textContent = res.error;
});

document.getElementById('registerSubmit').addEventListener('click', async () => {
    const name     = document.getElementById('regName').value.trim();
    const login    = document.getElementById('regLogin').value.trim();
    const password = document.getElementById('regPassword').value;
    const errorEl  = document.getElementById('registerError');
    if (!name || !login || !password) { errorEl.textContent = 'Заповніть всі поля'; return; }
    if (password.length < 4)          { errorEl.textContent = 'Пароль мінімум 4 символи'; return; }
    errorEl.textContent = '⏳ Реєстрація...';
    const res = await DB.register(name, login, password);
    if (res.ok) await onLoggedIn(res.user);
    else        errorEl.textContent = res.error;
});

// ══ ПРОФІЛЬ ═════════════════════════════════════════════════
function renderProfile(user) {
    const el = document.getElementById('profileInfo');
    if (!el) return;
    el.innerHTML = `
        <div class="profile-name">👤 ${user.name}</div>
        <div class="profile-login">@${user.login}</div>
        <div class="profile-id">ID: ${user.profileId}</div>
        <button id="logoutBtn" class="auth-submit" style="margin-top:20px;">Вийти</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', () => { DB.logout(); location.reload(); });
}

// ══ ПЛЕЙЛИСТИ ═══════════════════════════════════════════════
async function renderPlaylists() {
    const session   = DB.getSession();
    const container = document.getElementById('playlistsContainer');
    if (!container || !session) return;

    container.innerHTML = '<div class="pl-empty">⏳ Завантаження...</div>';
    try {
        const pls = await DB.getPlaylists(session.profileId);
        container.innerHTML = '';
        if (!pls.length) { container.innerHTML = '<div class="pl-empty">Плейлистів ще немає</div>'; return; }

        pls.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            const badge = pl.isPublic ? '<span class="pl-public-badge">🌐 публічний</span>' : '';
            item.innerHTML = `
                <div class="pl-item-info">
                    <span class="pl-name">${pl.name}${badge}</span>
                    <span class="pl-count">${pl.songIDs.length} пісень</span>
                </div>
                <button class="pl-delete-btn">✕</button>
            `;
            item.querySelector('.pl-item-info').addEventListener('click', () => openPlaylist(pl));
            item.querySelector('.pl-delete-btn').addEventListener('click', async e => {
                e.stopPropagation();
                if (!confirm(`Видалити "${pl.name}"?`)) return;
                await withLoading(null, async () => {
                    await DB.deletePlaylist(pl.id, session.profileId);
                    await renderPlaylists();
                });
            });
            container.appendChild(item);
        });
    } catch (err) {
        container.innerHTML = `<div class="pl-empty">❌ ${err.message}</div>`;
    }
}

function openPlaylist(pl) {
    const songs   = pl.songIDs.map(id => SONGS.find(s => s.id === id)).filter(Boolean);
    const session = DB.getSession();

    document.getElementById('plMainView').classList.add('hidden');
    document.getElementById('plDetailView').classList.remove('hidden');
    document.getElementById('activePlName').textContent = pl.name;

    const listEl = document.getElementById('playlistSongList');
    listEl.innerHTML = '';

    if (!songs.length) {
        listEl.innerHTML = '<div class="pl-empty">Плейлист порожній</div>';
        return;
    }

    songs.forEach((song, idx) => {
        const btn = document.createElement('button');
        btn.className = 'song-item';
        if (song.id === currentSongID) btn.classList.add('active');
        const thumbSrc = song.previewURL ? convertDropboxUrl(song.previewURL).replace('dl=1','raw=1') : '';
        btn.innerHTML = `
            <span class="song-num">${idx+1}</span>
            <img class="song-thumb" src="${thumbSrc}" onerror="this.style.display='none'">
            <div class="song-details">
                <div class="song-title">${song.nameSong}</div>
                <div class="song-date">${song.dateUpdate}</div>
            </div>
            <button class="pl-delete-btn">✕</button>
        `;
        btn.addEventListener('click', e => {
            if (e.target.closest('.pl-delete-btn')) return;
            queue = songs; queueIdx = idx;
            playSong(songs[idx]);
            listEl.querySelectorAll('.song-item').forEach((el,i) => el.classList.toggle('active', i===idx));
            switchToTab('Home');
        });
        btn.querySelector('.pl-delete-btn').addEventListener('click', async e => {
            e.stopPropagation();
            try {
                await DB.removeSongFromPlaylist(pl.id, song.id, session.profileId);
                pl.songIDs = pl.songIDs.filter(id => id !== song.id);
                openPlaylist(pl);
            } catch (err) { showToast('❌ ' + err.message); }
        });
        listEl.appendChild(btn);
    });
}

async function openAddToPlaylistModal(songID) {
    const session = DB.getSession();
    if (!session) return;
    const modal  = document.getElementById('addToPlaylistModal');
    const listEl = document.getElementById('playlistChoiceList');
    modal.classList.remove('hidden');
    listEl.innerHTML = '<div class="pl-empty">⏳ Завантаження...</div>';
    try {
        const pls = await DB.getPlaylists(session.profileId);
        listEl.innerHTML = '';
        if (!pls.length) { listEl.innerHTML = '<div class="pl-empty">Спочатку створіть плейлист</div>'; return; }
        pls.forEach(pl => {
            const btn = document.createElement('button');
            btn.className = 'pl-choice-btn';
            btn.textContent = pl.name;
            btn.addEventListener('click', async () => {
                modal.classList.add('hidden');
                try {
                    const res = await DB.addSongToPlaylist(pl.id, songID, session.profileId);
                    showToast(res.already ? `ℹ️ Вже є в "${pl.name}"` : `✅ Додано до "${pl.name}"`);
                } catch (err) { showToast('❌ ' + err.message); }
            });
            listEl.appendChild(btn);
        });
    } catch (err) {
        listEl.innerHTML = `<div class="pl-empty">❌ ${err.message}</div>`;
    }
}

// ══ MENU ════════════════════════════════════════════════════
function renderDeleteList() {
    const container = document.getElementById('deleteSongList');
    const session   = DB.getSession();
    if (!container) return;
    if (!session)   { container.innerHTML = '<div class="pl-empty">Увійдіть</div>'; return; }

    const query   = (document.getElementById('deleteSongSearch')?.value || '').toLowerCase();
    const mySongs = SONGS.filter(s => s.profileId === session.profileId && s.nameSong.toLowerCase().includes(query));

    container.innerHTML = '';
    if (!mySongs.length) { container.innerHTML = '<div class="pl-empty">Пісень не знайдено</div>'; return; }

    mySongs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';
        const thumbSrc = song.previewURL ? convertDropboxUrl(song.previewURL).replace('dl=1','raw=1') : '';
        item.innerHTML = `
            <span class="song-num">${song.id}</span>
            <img class="song-thumb" src="${thumbSrc}" onerror="this.style.display='none'">
            <div class="song-details">
                <div class="song-title">${song.nameSong}</div>
                <div class="song-date">${song.dateUpdate}</div>
            </div>
            <button class="pl-delete-btn">🗑</button>
        `;
        item.querySelector('.pl-delete-btn').addEventListener('click', () => confirmDeleteSong(song));
        container.appendChild(item);
    });
}

function confirmDeleteSong(song) {
    const modal  = document.getElementById('deleteConfirmModal');
    const textEl = document.getElementById('deleteConfirmText');
    const yesBtn = document.getElementById('deleteConfirmYes');

    textEl.innerHTML = `
        Ви збираєтесь видалити:<br>
        <strong>"${song.nameSong}"</strong> (ID: ${song.id})<br><br>
        <span class="delete-warn">Пісня буде видалена з бібліотеки та з усіх плейлистів. Це незворотньо.</span>
    `;
    modal.classList.remove('hidden');

    const newYes = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYes, yesBtn);
    newYes.addEventListener('click', async () => {
        const session = DB.getSession();
        modal.classList.add('hidden');
        if (currentSongID === song.id) {
            const audio = document.getElementById('audio');
            audio.pause(); audio.src = '';
            document.getElementById('playPauseBtn').textContent = '▶';
            document.getElementById('trackInfo').textContent    = 'Завантажте трек';
            isPlaying = false; currentSongID = null; queue = []; queueIdx = -1;
        }
        showToast('⏳ Видалення...');
        try {
            await DB.deleteSong(song.id, session.profileId);
            SONGS = await DB.getSongs();
            renderList(); renderDeleteList();
            await renderPlaylists();
            showToast(`🗑️ "${song.nameSong}" видалено`);
        } catch (err) { showToast('❌ ' + err.message); }
    });
}

// ══ ПЛЕЄР ═══════════════════════════════════════════════════
function playSong(song) {
    const audio        = document.getElementById('audio');
    const trackInfo    = document.getElementById('trackInfo');
    const coverImg     = document.getElementById('coverImg');
    const noTrackMsg   = document.getElementById('noTrackMsg');
    const playPauseBtn = document.getElementById('playPauseBtn');
    currentSongID = song.id;
    audio.src = convertDropboxUrl(song.songURL);
    if (song.previewURL) {
        coverImg.src = convertDropboxUrl(song.previewURL).replace('dl=1','raw=1');
        coverImg.classList.remove('hidden');
    }
    if (noTrackMsg) noTrackMsg.style.display = 'none';
    trackInfo.textContent = `${song.nameSong}`;
    trackInfo.style.display = 'block';
    audio.play().then(() => { isPlaying = true; playPauseBtn.textContent = '⏸'; }).catch(console.error);
}

function loadTrack(idx) {
    queue = SONGS; queueIdx = idx;
    playSong(SONGS[idx]);
    setActiveDiscoverItem(SONGS[idx].id);
    switchToTab('Home');
}

function renderList() {
    const container = document.getElementById('songList');
    if (!container) return;
    container.innerHTML = '';
    SONGS.forEach((song, idx) => {
        const btn = document.createElement('button');
        btn.className = 'song-item';
        if (song.id === currentSongID) btn.classList.add('active');
        const thumbSrc = song.previewURL ? convertDropboxUrl(song.previewURL).replace('dl=1','raw=1') : '';
        btn.innerHTML = `
            <span class="song-num">${song.id}</span>
            <img class="song-thumb" src="${thumbSrc}" onerror="this.style.display='none'">
            <div class="song-details">
                <div class="song-title">${song.nameSong}</div>
                <div class="song-date">${song.dateUpdate}</div>
            </div>
        `;
        btn.addEventListener('click', () => loadTrack(idx));
        container.appendChild(btn);
    });
    const old = document.getElementById('searchInput');
    const neu = old.cloneNode(true);
    old.parentNode.replaceChild(neu, old);
    neu.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        container.querySelectorAll('.song-item').forEach(b => {
            b.style.display = b.querySelector('.song-title').textContent.toLowerCase().includes(q) ? 'flex' : 'none';
        });
    });
}

function setActiveDiscoverItem(songID) {
    document.querySelectorAll('#songList .song-item').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.querySelector('.song-num')?.textContent) === songID);
    });
    document.querySelector('#songList .song-item.active')?.scrollIntoView({ block: 'nearest' });
}

// ══ ПУБЛІЧНІ ПЛЕЙЛИСТИ ══════════════════════════════════════
async function renderPublicPlaylists() {
    const listEl = document.getElementById('publicPlaylistsList');
    if (!listEl) return;
    document.getElementById('publicPlMainView').classList.remove('hidden');
    document.getElementById('publicPlDetailView').classList.add('hidden');

    listEl.innerHTML = '<div class="pl-empty">⏳ Завантаження...</div>';
    try {
        const query = (document.getElementById('searchPublicPl')?.value || '').toLowerCase();
        const pls   = (await DB.getPublicPlaylists()).filter(p =>
            p.name.toLowerCase().includes(query)
        );
        listEl.innerHTML = '';
        if (!pls.length) {
            listEl.innerHTML = '<div class="pl-empty">Публічних плейлистів немає</div>';
            return;
        }
        for (const pl of pls) {
            const item       = document.createElement('div');
            item.className   = 'playlist-item';
            const authorName = await DB.getUserName(pl.profileId);
            item.innerHTML = `
                <div class="pl-item-info">
                    <span class="pl-name">${pl.name}</span>
                    <span class="pl-count">${pl.songIDs.length} пісень · ${authorName}</span>
                </div>
                <button class="pl-add-btn">＋ В мої</button>
            `;
            item.querySelector('.pl-item-info').addEventListener('click', () => openPublicPlaylist(pl));
            item.querySelector('.pl-add-btn').addEventListener('click', async e => {
                e.stopPropagation();
                const session = DB.getSession();
                if (!session) { showToast('Увійдіть для цього'); return; }
                openCopyToPlaylistModal(pl, session);
            });
            listEl.appendChild(item);
        }
    } catch (err) {
        listEl.innerHTML = `<div class="pl-empty">❌ ${err.message}</div>`;
    }
}

function openPublicPlaylist(pl) {
    document.getElementById('publicPlMainView').classList.add('hidden');
    document.getElementById('publicPlDetailView').classList.remove('hidden');
    document.getElementById('publicPlDetailName').textContent = pl.name;

    const songs  = pl.songIDs.map(id => SONGS.find(s => s.id === id)).filter(Boolean);
    const listEl = document.getElementById('publicPlSongList');
    listEl.innerHTML = '';

    if (!songs.length) {
        listEl.innerHTML = '<div class="pl-empty">Плейлист порожній</div>';
        return;
    }
    songs.forEach((song, idx) => {
        const btn = document.createElement('button');
        btn.className = 'song-item';
        if (song.id === currentSongID) btn.classList.add('active');
        const thumbSrc = song.previewURL ? convertDropboxUrl(song.previewURL).replace('dl=1','raw=1') : '';
        btn.innerHTML = `
            <span class="song-num">${idx+1}</span>
            <img class="song-thumb" src="${thumbSrc}" onerror="this.style.display='none'">
            <div class="song-details">
                <div class="song-title">${song.nameSong}</div>
                <div class="song-date">${song.dateUpdate}</div>
            </div>
        `;
        btn.addEventListener('click', () => {
            queue = songs; queueIdx = idx;
            playSong(songs[idx]);
            listEl.querySelectorAll('.song-item').forEach((el,i) => el.classList.toggle('active', i===idx));
            switchToTab('Home');
        });
        listEl.appendChild(btn);
    });
}

async function openCopyToPlaylistModal(sourcePl, session) {
    const modal  = document.getElementById('addToPlaylistModal');
    const listEl = document.getElementById('playlistChoiceList');
    const title  = modal.querySelector('.modal-title');
    title.textContent = `Копіювати до свого плейлиста`;
    modal.classList.remove('hidden');
    listEl.innerHTML = '<div class="pl-empty">⏳ Завантаження...</div>';
    try {
        const myPls = await DB.getPlaylists(session.profileId);
        listEl.innerHTML = '';
        if (!myPls.length) {
            listEl.innerHTML = '<div class="pl-empty">Спочатку створіть плейлист</div>';
            return;
        }
        myPls.forEach(pl => {
            const btn = document.createElement('button');
            btn.className = 'pl-choice-btn';
            btn.textContent = pl.name;
            btn.addEventListener('click', async () => {
                modal.classList.add('hidden');
                title.textContent = 'Додати до плейлиста';
                let added = 0;
                for (const songId of sourcePl.songIDs) {
                    try {
                        const res = await DB.addSongToPlaylist(pl.id, songId, session.profileId);
                        if (res.ok) added++;
                    } catch {}
                }
                showToast(`✅ Додано ${added} пісень до "${pl.name}"`);
                await renderPlaylists();
            });
            listEl.appendChild(btn);
        });
    } catch (err) {
        listEl.innerHTML = `<div class="pl-empty">❌ ${err.message}</div>`;
    }
}

function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'toast show';
    clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove('show'), 2500);
}


