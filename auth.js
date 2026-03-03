// auth.js
const Auth = (() => {
    async function hashPassword(password) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

    function generateProfileID() {
        return 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    }

    function getUsers()        { return JSON.parse(localStorage.getItem('users') || '[]'); }
    function saveUsers(u)      { localStorage.setItem('users', JSON.stringify(u)); }
    function getSession()      { return JSON.parse(localStorage.getItem('session') || 'null'); }
    function saveSession(user) { const {passwordHash,...s}=user; localStorage.setItem('session', JSON.stringify(s)); }
    function logout()          { localStorage.removeItem('session'); }

    async function register(name, login, password) {
        const users = getUsers();
        if (users.find(u => u.login === login)) return { ok:false, error:'Логін вже зайнятий' };
        const passwordHash = await hashPassword(password);
        const profileID = generateProfileID();
        const newUser = { profileID, name, login, passwordHash };
        users.push(newUser);
        saveUsers(users);
        saveSession(newUser);
        return { ok:true, user:{ profileID, name, login } };
    }

    async function loginUser(login, password) {
        const user = getUsers().find(u => u.login === login);
        if (!user) return { ok:false, error:'Користувача не знайдено' };
        const hash = await hashPassword(password);
        if (user.passwordHash !== hash) return { ok:false, error:'Невірний пароль' };
        saveSession(user);
        return { ok:true, user:{ profileID:user.profileID, name:user.name, login:user.login } };
    }

    return { register, loginUser, logout, getSession };
})();
