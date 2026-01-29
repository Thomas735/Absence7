import { appState, loadProgress, saveProgress, getCurrentCalendar, addCalendar, deleteCalendar, switchCalendar, refreshCalendar, addManualEvent, renameCalendar } from './state.js';
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
    const renameCalBtn = document.getElementById("renameCalBtn");
    const backToCalendarBtn = document.getElementById("backToCalendarBtn");

    // Add Activity UI
    const openAddActivityBtn = document.getElementById("openAddActivityBtn");
    const addActivityPopup = document.getElementById("addActivityPopup");
    const closeAddActivityPopup = document.getElementById("closeAddActivityPopup");
    const addActivityForm = document.getElementById("addActivityForm");

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

    if (renameCalBtn) {
        renameCalBtn.addEventListener('click', () => {
            const cal = getCurrentCalendar();
            if (!cal) return;

            const newName = prompt("Nouveau nom du calendrier :", cal.name);
            if (newName && newName.trim() !== "") {
                renameCalendar(cal.id, newName.trim());
                renderCalendarList(); // Logic to refresh name in list
            }
            gestionDropdown.style.display = 'none';
        });
    }

    backToCalendarBtn.addEventListener('click', () => {
        switchView('month'); // Return to default view
    });


    // --- ADD ACTIVITY LOGIC ---
    if (openAddActivityBtn) {
        openAddActivityBtn.addEventListener('click', () => {
            const cal = getCurrentCalendar();
            if (!cal) {
                alert("Veuillez d'abord sélectionner ou créer un calendrier.");
                return;
            }
            gestionDropdown.style.display = 'none'; // Close menu
            addActivityPopup.style.display = 'flex';
        });
    }

    if (closeAddActivityPopup) {
        closeAddActivityPopup.addEventListener('click', () => {
            addActivityPopup.style.display = 'none';
        });
    }

    if (addActivityForm) {
        addActivityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const cal = getCurrentCalendar();
            if (!cal) return;

            const name = document.getElementById('actName').value;
            const prof = document.getElementById('actProf').value;
            const dayOfWeek = parseInt(document.getElementById('actDay').value); // 0=Sun, 1=Mon...
            const timeStr = document.getElementById('actTime').value; // "HH:MM"
            const durationMins = parseInt(document.getElementById('actDuration').value);
            const isRecurring = document.getElementById('actRepeat').checked;

            if (!name || !timeStr) return;

            const [hours, minutes] = timeStr.split(':').map(Number);

            // Calculate Start Date based on Current Week or Next occurrence
            // Strategy: Start from *current viewing week* or *today*? 
            // Let's start from the Monday of the current "currentDate" being viewed/stored in state
            // to ensure it appears where the user is looking, OR just finding the next occurrence from today.
            // Requirement says "Semester", so let's start from Today/Current Week and go forward.

            // Let's pick the Monday of the current appState.currentDate (which usually tracks the view)
            const refDate = new Date(appState.currentDate);
            // Reset to Monday of that week
            const currentDay = refDate.getDay();
            const diff = refDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
            refDate.setDate(diff);
            refDate.setHours(0, 0, 0, 0);

            // Now find the target day in this week
            // dayOfWeek: 1=Mon ... 0=Sun. 
            // Our refDate is Monday. 
            // If target is Mon (1), offset is 0.
            // If target is Tue (2), offset is 1.
            // If target is Sun (0), offset is 6.
            let dayOffset = 0;
            if (dayOfWeek === 0) dayOffset = 6;
            else dayOffset = dayOfWeek - 1;

            const startDate = new Date(refDate);
            startDate.setDate(startDate.getDate() + dayOffset);
            startDate.setHours(hours, minutes, 0, 0);

            // Generate Events
            const eventsToAdd = [];
            const weeksToGenerate = isRecurring ? 24 : 1; // ~6 months for semester

            for (let i = 0; i < weeksToGenerate; i++) {
                const start = new Date(startDate);
                start.setDate(startDate.getDate() + (i * 7));

                const end = new Date(start);
                end.setMinutes(end.getMinutes() + durationMins);

                eventsToAdd.push({
                    title: name,
                    description: prof ? `${prof}` : '', // Simple description with Prof name
                    start: start,
                    end: end
                });
            }

            // Batch add ? The state helper currently adds one by one, let's just loop
            // In a real app we'd bulk add, but here loop is fine or we modify state helper.
            // Let's just modify the helper to accept an array? 
            // Or just loop here. Performance is negligible for 24 items.
            eventsToAdd.forEach(ev => addManualEvent(cal.id, ev));

            addActivityPopup.style.display = 'none';
            addActivityForm.reset();
            alert(`${eventsToAdd.length} activité(s) ajoutée(s).`);
        });
    }


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
