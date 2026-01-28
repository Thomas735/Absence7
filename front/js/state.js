export const appState = {
    currentDate: new Date(),
    events: [],
    currentView: 'month', // 'month' or 'week'
    skippedEventIds: new Set(), // Stores IDs of events marked as skipped
    icsFileContent: null,
    icsFileName: null
};

export async function saveProgress() {
    const dataToSave = {
        skippedEventIds: Array.from(appState.skippedEventIds),
        currentDate: appState.currentDate.toISOString(),
        currentView: appState.currentView,
        icsFileName: appState.icsFileName,
        icsFileContent: appState.icsFileContent
    };

    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSave)
        });
        if (response.ok) {
            console.log("💾 Données sauvegardées (Serveur)");
        } else {
            console.error("Erreur sauvegarde serveur");
        }
    } catch (e) {
        console.error("Erreur réseau sauvegarde:", e);
    }
}

export async function loadProgress() {
    try {
        const response = await fetch('/api/load');
        if (response.ok) {
            const data = await response.json();

            // Check if server data is empty but we have local data (Migration)
            if (data.empty && localStorage.getItem('absence7_data_v2')) {
                console.log("🔄 Migration des données locales vers le serveur...");
                migrateLocalData();
                return;
            }

            if (!data.empty) {
                applyData(data);
                console.log("📂 Données chargées (Serveur)");
            }
        }
    } catch (e) {
        console.error("Erreur chargement serveur:", e);
    }
}

function applyData(data) {
    if (data.skippedEventIds) {
        appState.skippedEventIds = new Set(data.skippedEventIds);
    }
    if (data.currentDate) {
        appState.currentDate = new Date(data.currentDate);
    }
    if (data.currentView) {
        appState.currentView = data.currentView;
    }
    if (data.icsFileName) appState.icsFileName = data.icsFileName;
    if (data.icsFileContent) appState.icsFileContent = data.icsFileContent;
}

function migrateLocalData() {
    const savedData = localStorage.getItem('absence7_data_v2');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            applyData(data);
            saveProgress(); // This will push it to the server

            // IMPORTANT: Nettoyer le cache local pour ne pas que le prochain utilisateur hérite de ces données
            localStorage.removeItem('absence7_data_v2');
            console.log("🧹 Données locales migrées et nettoyées.");
        } catch (e) {
            console.error(e);
        }
    }
}
