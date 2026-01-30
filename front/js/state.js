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

export async function switchCalendar(id) {
    const cal = appState.calendars.find(c => c.id === id);
    if (!cal) return;

    appState.currentCalendarId = id;

    // Sync global state for ICS parsing
    appState.icsFileContent = cal.icsFileContent;
    appState.skippedEventIds = cal.skippedEventIds; // Update global reference
    appState.skippedEventIds = cal.skippedEventIds; // Update global reference
    appState.unsignedProfessors = cal.unsignedProfessors; // Default to Set if exists, else init

    // Parse events for this calendar
    let parsedEvents = [];
    if (cal.icsFileContent) {
        parseICS(cal.icsFileContent); // Sets appState.events
        parsedEvents = [...appState.events];
    } else if (cal.subscriptionUrl) {
        if (!cal.icsFileContent) {
            await refreshCalendar(id);
            // Refresh calls parseICS so events are already set
            parsedEvents = [...appState.events];
        } else {
            parseICS(cal.icsFileContent);
            parsedEvents = [...appState.events];
        }
    } else {
        parsedEvents = [];
    }

    // MERGE MANUAL EVENTS
    // Ensure dates are Date objects
    const manuals = (cal.manualEvents || []).map(ev => ({
        ...ev,
        start: new Date(ev.start),
        end: new Date(ev.end)
    }));

    appState.events = [...parsedEvents, ...manuals];

    updateDisplay();
}

export function addManualEvent(calendarId, eventData) {
    const cal = appState.calendars.find(c => c.id === calendarId);
    if (!cal) return;

    if (!cal.manualEvents) cal.manualEvents = [];
    cal.manualEvents.push(eventData);

    // Refresh current view if we modified the active calendar
    if (appState.currentCalendarId === calendarId) {
        // We just append to current appState.events for immediate feedback
        // But switchCalendar logic cleans it up properly on reload
        appState.events.push({
            ...eventData,
            start: new Date(eventData.start),
            end: new Date(eventData.end)
        });
        updateDisplay();
    }
    saveProgress();
}

export async function addCalendar(name, subscriptionUrl = null) {
    const newId = 'cal_' + Date.now();
    const newCal = {
        id: newId,
        name: name,
        subscriptionUrl: subscriptionUrl,
        icsFileContent: null,
        icsFileName: null,
        lastCalendarView: 'month',
        skippedEventIds: new Set(),
        lastCalendarView: 'month',
        skippedEventIds: new Set(),
        unsignedProfessors: new Set(),
        manualEvents: [] // Array of { title, start, end, description }
    };
    appState.calendars.push(newCal);

    if (subscriptionUrl) {
        // Try to fetch immediately
        await refreshCalendar(newId);
    }

    if (!appState.currentCalendarId) {
        switchCalendar(newId);
    }
    saveProgress();
    return newId;
}

export function renameCalendar(id, newName) {
    const cal = appState.calendars.find(c => c.id === id);
    if (!cal) return;

    cal.name = newName;
    saveProgress();
    updateDisplay(); // Will update title
}

export async function refreshCalendar(id) {
    const cal = appState.calendars.find(c => c.id === id);
    if (!cal || !cal.subscriptionUrl) return;

    try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(cal.subscriptionUrl)}`);
        if (res.ok) {
            const text = await res.text();
            cal.icsFileContent = text;
            console.log(`Updated calendar ${cal.name} from URL`);

            // If currently active, re-parse and merge
            if (appState.currentCalendarId === id) {
                parseICS(cal.icsFileContent); // Sets appState.events with parsed ONLY

                // Merge Manuals
                const manuals = (cal.manualEvents || []).map(ev => ({
                    ...ev,
                    start: new Date(ev.start),
                    end: new Date(ev.end)
                }));
                appState.events = [...appState.events, ...manuals];

                updateDisplay();
            }
            saveProgress();
        } else {
            console.error("Failed to refresh calendar");
            alert("Erreur lors de l'actualisation du calendrier");
        }
    } catch (e) {
        console.error(e);
        alert("Erreur réseau lors de l'actualisation");
    }
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

export function duplicateCalendar(id) {
    const cal = appState.calendars.find(c => c.id === id);
    if (!cal) return;

    const newId = 'cal_' + Date.now();

    // Deep copy of the calendar object
    const newCal = {
        ...cal,
        id: newId,
        name: cal.name + " (Copie)",
        // Sets need to be new instances
        skippedEventIds: new Set(cal.skippedEventIds),
        unsignedProfessors: new Set(cal.unsignedProfessors),
        // Arrays need to be new instances (deep copy manual events)
        manualEvents: (cal.manualEvents || []).map(ev => ({ ...ev }))
    };

    appState.calendars.push(newCal);
    switchCalendar(newId);
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
    // FORCE DEFAULT BEHAVIOR ON REFRESH:
    // We do NOT restore currentDate or currentView from saved data.
    // appState.currentDate and appState.currentView remain at their defaults (Now, 'month').

    // if (data.currentDate) appState.currentDate = new Date(data.currentDate);
    // if (data.currentView) appState.currentView = data.currentView;

    if (data.calendars) {
        appState.calendars = data.calendars.map(c => ({
            ...c,
            skippedEventIds: new Set(c.skippedEventIds), // Hydrate Set
            ...c,
            skippedEventIds: new Set(c.skippedEventIds), // Hydrate Set
            unsignedProfessors: new Set(c.unsignedProfessors || []), // Hydrate Set
            manualEvents: c.manualEvents || []
        }));

        // AUTO-REFRESH SUBSCRIPTIONS ON LOAD
        // non-blocking (async) to let the UI load first
        appState.calendars.forEach(cal => {
            if (cal.subscriptionUrl) {
                console.log(`Auto-refreshing calendar: ${cal.name}`);
                refreshCalendar(cal.id);
            }
        });
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
        unsignedProfessors: new Set(oldData.unsignedProfessors || [])
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
