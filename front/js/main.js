import { appState, loadProgress, saveProgress } from './state.js';
import { initView, updateDisplay, switchView } from './view.js';
import { initEventPopup } from './eventManager.js';
import { parseICS } from './ics.js';

import { checkSession, login, register, logout, showLoginModal, hideLoginModal } from './auth.js';

document.addEventListener("DOMContentLoaded", async function () {
    const btn = document.getElementById("btn");
    // ... references ...

    // AUTH LOGIC
    let currentUser = null;
    const authModal = document.getElementById('authModal');
    const authTitle = document.getElementById('authTitle');
    const authUsername = document.getElementById('authUsername');
    const authPassword = document.getElementById('authPassword');
    const authError = document.getElementById('authError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');

    let isLoginMode = true;

    // Check Session
    const session = await checkSession();
    if (session.loggedIn) {
        currentUser = session.username;
        userInfo.style.display = 'flex';
        usernameDisplay.textContent = `Bonjour, ${currentUser}`;
        startApp();
    } else {
        showLoginModal();
    }

    // Auth Listeners
    logoutBtn.addEventListener('click', logout);

    toggleAuthMode.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? "Connexion" : "Créer un compte";
        loginSubmitBtn.textContent = isLoginMode ? "Se connecter" : "S'inscrire";
        toggleAuthMode.textContent = isLoginMode ? "Créer un compte" : "J'ai déjà un compte";
        authError.style.display = 'none';
    });

    loginSubmitBtn.addEventListener('click', async () => {
        const user = authUsername.value;
        const pass = authPassword.value;

        if (!user || !pass) {
            authError.textContent = "Veuillez remplir tous les champs";
            authError.style.display = 'block';
            return;
        }

        let res;
        if (isLoginMode) {
            res = await login(user, pass);
        } else {
            res = await register(user, pass);
        }

        if (res.success) {
            hideLoginModal();
            currentUser = res.username;
            userInfo.style.display = 'flex';
            usernameDisplay.textContent = `Bonjour, ${currentUser}`;
            startApp();
        } else {
            authError.textContent = res.error || "Une erreur est survenue";
            authError.style.display = 'block';
        }
    });

    function startApp() {
        // Initialisation standard
        initView();

        // Load data from server then render
        loadProgress().then(() => {
            if (appState.icsFileContent) {
                parseICS(appState.icsFileContent);
            }
            switchView(appState.currentView);
            initEventPopup();
        });
    }

    // STANDARD NAVIGATION (Existing code wrapped or after startApp)
    const fileInput = document.getElementById("fileInput");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const monthViewBtn = document.getElementById("monthViewBtn");
    const weekViewBtn = document.getElementById("weekViewBtn");
    const prevWeekBtn = document.getElementById("prevWeekBtn");
    const nextWeekBtn = document.getElementById("nextWeekBtn");

    // ... keep existing listeners ...

    // Navigation
    prevBtn.addEventListener("click", () => {
        if (appState.currentView === 'month') {
            appState.currentDate.setMonth(appState.currentDate.getMonth() - 1);
        } else {
            appState.currentDate.setDate(appState.currentDate.getDate() - 7);
        }
        updateDisplay();
    });

    nextBtn.addEventListener("click", () => {
        if (appState.currentView === 'month') {
            appState.currentDate.setMonth(appState.currentDate.getMonth() + 1);
        } else {
            appState.currentDate.setDate(appState.currentDate.getDate() + 7);
        }
        updateDisplay();
    });

    document.getElementById("resetButton").addEventListener("click", function () {
        if (confirm("Êtes-vous sûr de vouloir tout réinitialiser ? Toutes vos données seront perdues.")) {
            localStorage.clear();
            location.reload();
        }
    });

    // Changement de vue
    monthViewBtn.addEventListener("click", () => {
        switchView('month');
    });

    weekViewBtn.addEventListener("click", () => {
        switchView('week');
    });

    // Navigation semaine
    prevWeekBtn.addEventListener("click", () => {
        appState.currentDate.setDate(appState.currentDate.getDate() - 7);
        updateDisplay();
    });

    nextWeekBtn.addEventListener("click", () => {
        appState.currentDate.setDate(appState.currentDate.getDate() + 7);
        updateDisplay();
    });

    // Quand on clique sur "Importer un calendrier"
    btn.addEventListener("click", () => {
        fileInput.click();
    });

    // Quand on choisit un fichier
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;
        console.log("Fichier choisi :", file.name);
        appState.icsFileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            appState.icsFileContent = content;
            console.log("Contenu ICS (début):", content.substring(0, 500));

            parseICS(content);
            saveProgress(); // Save immediately after import
        };
        reader.readAsText(file);
    });
});
