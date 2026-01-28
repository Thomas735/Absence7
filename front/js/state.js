import { parseICS } from './ics.js';
import { updateDisplay, switchView } from './view.js';

export const appState = {
    currentDate: new Date(),
    currentView: 'month',
    lastCalendarView: 'month', // Tracks context for specialized views like 'professors'

    // Multi-Calendar Structure
    currentCalendarId: null,
    calendars: [] // Array of { id, name, icsFileContent, icsFileName, skippedEventIds: Set }
};

// --- Calendar Management ---

export function getCurrentCalendar() {
    if (!appState.currentCalendarId) return null;
    return appState.calendars.find(c => c.id === appState.currentCalendarId);
}

export function switchCalendar(id) {
    const cal = appState.calendars.find(c => c.id === id);
    if (!cal) return;

    appState.currentCalendarId = id;

    // Sync global state for ICS parsing
    appState.icsFileContent = cal.icsFileContent;
    appState.skippedEventIds = cal.skippedEventIds; // Update global reference
    appState.unsignedProfessors = cal.unsignedProfessors; // Default to Set if exists, else init

    // Parse events for this calendar
    if (cal.icsFileContent) {
        parseICS(cal.icsFileContent);
    } else {
        appState.events = []; // Clear events if no content
    }

    updateDisplay();
}

export function addCalendar(name) {
    const newId = 'cal_' + Date.now();
    const newCal = {
        id: newId,
        name: name,
        icsFileContent: null,
        icsFileName: null,
        lastCalendarView: 'month',
        skippedEventIds: new Set(),
        unsignedProfessors: new Set()
    };
    appState.calendars.push(newCal);
    if (!appState.currentCalendarId) {
        switchCalendar(newId);
    }
    saveProgress();
    return newId;
}

export function deleteCalendar(id) {
    if (appState.calendars.length <= 1) {
        alert("Impossible de supprimer le dernier calendrier.");
        return;
    }

    appState.calendars = appState.calendars.filter(c => c.id !== id);

    // If we deleted the current one, switch to the first available
    if (appState.currentCalendarId === id) {
        switchCalendar(appState.calendars[0].id);
    }
    saveProgress();
}

// --- Persistence ---

export async function saveProgress() {
    // We save the array of calendars + metadata
    // We need to serialize Sets to Arrays
    const calendarsToSave = appState.calendars.map(cal => ({
        ...cal,
        skippedEventIds: Array.from(cal.skippedEventIds),
        unsignedProfessors: Array.from(cal.unsignedProfessors || [])
    }));

    const dataToSave = {
        currentDate: appState.currentDate.toISOString(),
        currentView: appState.currentView,
        currentCalendarId: appState.currentCalendarId,
        calendars: calendarsToSave,
        version: 2 // Marker for new structure
    };

    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        if (response.ok) {
            console.log("💾 Calendriers sauvegardés");
        }
    } catch (e) {
        console.error("Erreur sauvegarde:", e);
    }
}

export async function loadProgress() {
    try {
        const response = await fetch('/api/load');
        if (response.ok) {
            const data = await response.json();

            // 1. MIGRATION: Check if it's the old format (no 'calendars' array)
            if (!data.empty && !data.calendars && (data.icsFileContent || data.skippedEventIds)) {
                console.log("🔄 Migration des données existantes vers le format Multi-Calendrier...");
                migrateOldFormat(data);
            }
            // 2. NORMAL LOAD
            else if (!data.empty && data.calendars) {
                applyData(data);
                console.log("📂 Calendriers chargées");
            }
            // 3. NEW USER (Empty)
            else if (data.empty) {
                // Check LocalStorage for even older data
                if (localStorage.getItem('absence7_data_v2')) {
                    migrateLocalData();
                } else {
                    // Create default calendar
                    if (appState.calendars.length === 0) {
                        addCalendar("Mon Calendrier");
                    }
                }
            }
        }
    } catch (e) {
        console.error("Erreur chargement:", e);
    }
}

function applyData(data) {
    if (data.currentDate) appState.currentDate = new Date(data.currentDate);
    if (data.currentView) appState.currentView = data.currentView;

    if (data.calendars) {
        appState.calendars = data.calendars.map(c => ({
            ...c,
            skippedEventIds: new Set(c.skippedEventIds), // Hydrate Set
            unsignedProfessors: new Set(c.unsignedProfessors || []) // Hydrate Set
        }));
    }

    if (data.currentCalendarId) {
        switchCalendar(data.currentCalendarId);
    } else if (appState.calendars.length > 0) {
        switchCalendar(appState.calendars[0].id);
    }
}

function migrateOldFormat(oldData) {
    // Create a default calendar with the old data
    const calId = 'cal_default';
    const defaultCal = {
        id: calId,
        name: "Mon Calendrier",
        icsFileContent: oldData.icsFileContent || null,
        icsFileName: oldData.icsFileName || null,
        skippedEventIds: new Set(oldData.skippedEventIds || []),
        unsignedProfessors: new Set()
    };

    appState.calendars = [defaultCal];
    applyData(oldData); // Load view settings
    switchCalendar(calId);

    saveProgress(); // Update server with new structure
}

function migrateLocalData() {
    const savedData = localStorage.getItem('absence7_data_v2');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            migrateOldFormat(data);
            localStorage.removeItem('absence7_data_v2');
            console.log("🧹 Migration LocalStorage terminée.");
        } catch (e) {
            console.error(e);
        }
    }
}
