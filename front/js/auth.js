export async function register(username, password) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    } catch (e) {
        return { error: "Erreur réseau" };
    }
}

export async function login(username, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    } catch (e) {
        return { error: "Erreur réseau" };
    }
}

export async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
    } catch (e) {
        console.error(e);
    }
}

export async function checkSession() {
    try {
        const response = await fetch('/api/auth/me');
        return await response.json();
    } catch (e) {
        return { loggedIn: false };
    }
}

export function showLoginModal() {
    let modal = document.getElementById('authModal');
    if (!modal) {
        console.error("Auth modal not found in DOM");
        return;
    }
    modal.style.display = 'flex';
}

export function hideLoginModal() {
    let modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
}
