import { appState, loadProgress, saveProgress, getCurrentCalendar, addCalendar, deleteCalendar, switchCalendar, refreshCalendar } from './state.js';
import { initView, updateDisplay, switchView } from './view.js';
import { initEventPopup } from './eventManager.js';
import { parseICS } from './ics.js';
import { checkSession, login, register, logout, showLoginModal, hideLoginModal } from './auth.js';

document.addEventListener("DOMContentLoaded", async function () {
    // --- REFERENCES UI ---
    const btn = document.getElementById("btn");
    const gestionBtn = document.getElementById("gestionBtn"); // Dropdown Button
    const gestionDropdown = document.getElementById("gestionDropdown"); // Dropdown Content
    const calendarList = document.getElementById("calendarList");
    const addCalBtn = document.getElementById("addCalBtn");
    const delCalBtn = document.getElementById("delCalBtn");
    const professorsBtn = document.getElementById("professorsBtn");
    const backToCalendarBtn = document.getElementById("backToCalendarBtn");

    const fileInput = document.getElementById("fileInput");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const monthViewBtn = document.getElementById("monthViewBtn");
    const weekViewBtn = document.getElementById("weekViewBtn");
    const prevWeekBtn = document.getElementById("prevWeekBtn");
    const nextWeekBtn = document.getElementById("nextWeekBtn");


    // --- AUTH LOGIC ---
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

    // Check Session on Load
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
        initView();
        loadProgress().then(() => {
            // LoadProgress handles switchCalendar which calls updateDisplay
            if (!appState.currentCalendarId && appState.calendars.length > 0) {
                switchCalendar(appState.calendars[0].id);
            }

            // Sync UI with loaded state (Buttons + Divs)
            switchView(appState.currentView);

            initEventPopup();
            renderCalendarList(); // Render list once loaded
        });
    }


    // --- GESTION DROPDOWN LOGIC ---

    function renderCalendarList() {
        if (!calendarList) return;
        calendarList.innerHTML = '';

        appState.calendars.forEach(cal => {
            const li = document.createElement('li');

            // Container for Name + Refresh Button
            const contentDiv = document.createElement('div');
            contentDiv.style.display = 'flex';
            contentDiv.style.justifyContent = 'space-between';
            contentDiv.style.alignItems = 'center';
            contentDiv.style.width = '100%';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = cal.name;
            contentDiv.appendChild(nameSpan);

            if (cal.subscriptionUrl) {
                const refreshBtn = document.createElement('button');
                refreshBtn.innerHTML = '↻'; // Refresh icon
                refreshBtn.title = "Actualiser l'abonnement";
                refreshBtn.className = 'btn small-btn';
                refreshBtn.style.padding = '2px 6px';
                refreshBtn.style.fontSize = '0.8rem';
                refreshBtn.style.marginLeft = '8px';

                refreshBtn.onclick = async (e) => {
                    e.stopPropagation();
                    refreshBtn.classList.add('rotating'); // Add spinning class if css exists, or just visual feedback
                    await refreshCalendar(cal.id);
                    refreshBtn.classList.remove('rotating');
                };
                contentDiv.appendChild(refreshBtn);
            }

            li.appendChild(contentDiv);

            if (cal.id === appState.currentCalendarId) {
                li.classList.add('active');
            }

            li.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing dropdown
                switchCalendar(cal.id);
                renderCalendarList();
            });

            calendarList.appendChild(li);
        });
    }

    // Toggle Dropdown
    gestionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = gestionDropdown.style.display === 'flex';
        gestionDropdown.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) renderCalendarList();
    });

    // Close Dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!gestionBtn.contains(e.target) && !gestionDropdown.contains(e.target)) {
            gestionDropdown.style.display = 'none';
        }
    });

    // Add Calendar
    addCalBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = prompt("Nom du nouveau calendrier :");
        if (name) {
            const url = prompt("URL de l'abonnement ICS (facultatif, laisser vide pour un calendrier local) :");
            await addCalendar(name, url ? url.trim() : null);
            renderCalendarList();
        }
    });

    // Delete Calendar
    delCalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cal = getCurrentCalendar();
        if (cal) {
            if (confirm(`Supprimer le calendrier "${cal.name}" ?`)) {
                deleteCalendar(cal.id);
                renderCalendarList();
            }
        }
    });

    // Professors View Navigation
    professorsBtn.addEventListener('click', () => {
        switchView('professors');
        gestionDropdown.style.display = 'none'; // Close dropdown
    });

    backToCalendarBtn.addEventListener('click', () => {
        switchView('month'); // Return to default view
    });


    // --- STANDARD NAVIGATION ---

    prevBtn.addEventListener("click", () => {
        const mode = appState.currentView === 'professors' ? appState.lastCalendarView : appState.currentView;

        if (mode === 'month') {
            appState.currentDate.setMonth(appState.currentDate.getMonth() - 1);
        } else {
            appState.currentDate.setDate(appState.currentDate.getDate() - 7);
        }
        updateDisplay();
    });

    nextBtn.addEventListener("click", () => {
        const mode = appState.currentView === 'professors' ? appState.lastCalendarView : appState.currentView;

        if (mode === 'month') {
            appState.currentDate.setMonth(appState.currentDate.getMonth() + 1);
        } else {
            appState.currentDate.setDate(appState.currentDate.getDate() + 7);
        }
        updateDisplay();
    });

    monthViewBtn.addEventListener("click", () => {
        switchView('month');
    });

    weekViewBtn.addEventListener("click", () => {
        switchView('week');
    });

    prevWeekBtn.addEventListener("click", () => {
        appState.currentDate.setDate(appState.currentDate.getDate() - 7);
        updateDisplay();
    });

    nextWeekBtn.addEventListener("click", () => {
        appState.currentDate.setDate(appState.currentDate.getDate() + 7);
        updateDisplay();
    });

    // Import ICS
    btn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;

            // SAVE TO CURRENT CALENDAR
            const cal = getCurrentCalendar();
            if (cal) {
                cal.icsFileContent = content;
                cal.icsFileName = file.name;

                // Parse and Save
                parseICS(content);
                saveProgress();
                updateDisplay();
            } else {
                alert("Erreur: Aucun calendrier sélectionné.");
            }
        };
        reader.readAsText(file);
    });

});
