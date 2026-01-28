import { appState, saveProgress } from './state.js';
import { extractCourseCode, getEventId } from './utils.js';
import { updateDisplay } from './view.js';

let eventPopup, popupTitle, popupDate, popupTime, popupDescription;
let progressBarFill, progressPercentage, progressText;

export function initEventPopup() {
    eventPopup = document.getElementById("eventPopup");
    popupTitle = document.getElementById("popupTitle");
    popupDate = document.getElementById("popupDate");
    popupTime = document.getElementById("popupTime");
    popupDescription = document.getElementById("popupDescription");

    progressBarFill = document.getElementById("progressBarFill");
    progressPercentage = document.getElementById("progressPercentage");
    progressText = document.getElementById("progressText");

    const closePopupBtn = document.querySelector(".close-popup");

    closePopupBtn.addEventListener("click", closeEventPopup);

    eventPopup.addEventListener("click", function (event) {
        if (event.target === eventPopup) {
            closeEventPopup();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeEventPopup();
        }
    });
}

export function openEventPopup(event) {
    const title = event.title || "Sans titre";
    const date = event.start.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const time = event.start.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const endTime = event.end ? event.end.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    }) : "";

    const timeDisplay = endTime ? `${time} - ${endTime}` : time;
    const description = event.description || "Aucune description";

    // Identifier current event
    const eventId = getEventId(event);
    const courseCode = extractCourseCode(event.title, event.description);

    // Get stats for THIS course code (aggregated)
    const stats = getCourseStats(courseCode);
    const percentage = stats.totalDuration > 0 ? (stats.skippedDuration / stats.totalDuration) * 100 : 0;
    const progressPercentageVal = Math.min(100, Math.round(percentage));

    popupTitle.textContent = title;
    popupDate.textContent = date;
    popupTime.textContent = timeDisplay;
    popupDescription.textContent = description;

    updateProgressBar(progressPercentageVal, stats.skippedDuration, stats.totalDuration);

    // Configure buttons
    const skipButton = document.getElementById("skipButton");
    const unskipButton = document.getElementById("unskipButton");

    // Clean previous listeners (simple way: replace node clone or reassign onclick)
    // Reassigning onclick is safe here as we only have one popup
    skipButton.onclick = function () {
        if (!appState.skippedEventIds.has(eventId)) {
            appState.skippedEventIds.add(eventId);

            // Updated stats
            const newStats = getCourseStats(courseCode);
            const newPct = newStats.totalDuration > 0 ? (newStats.skippedDuration / newStats.totalDuration) * 100 : 0;
            updateProgressBar(Math.round(newPct), newStats.skippedDuration, newStats.totalDuration);
            saveProgress();
            updateDisplay();
        }
    };

    unskipButton.onclick = function () {
        if (appState.skippedEventIds.has(eventId)) {
            appState.skippedEventIds.delete(eventId);

            // Updated stats
            const newStats = getCourseStats(courseCode);
            const newPct = newStats.totalDuration > 0 ? (newStats.skippedDuration / newStats.totalDuration) * 100 : 0;
            updateProgressBar(Math.round(newPct), newStats.skippedDuration, newStats.totalDuration);
            saveProgress();
            updateDisplay();
        }
    };

    eventPopup.style.display = "block";
    document.body.style.overflow = "hidden";
}

export function closeEventPopup() {
    if (eventPopup) {
        eventPopup.style.display = "none";
        document.body.style.overflow = "";
    }
}

function getCourseStats(targetCourseCode) {
    let totalDuration = 0;
    let skippedDuration = 0;

    appState.events.forEach(ev => {
        const code = extractCourseCode(ev.title, ev.description);
        if (code === targetCourseCode) {
            const duration = ev.end ? (ev.end - ev.start) / (1000 * 60 * 60) : 2;
            totalDuration += duration;

            const evId = getEventId(ev);
            if (appState.skippedEventIds.has(evId)) {
                skippedDuration += duration;
            }
        }
    });

    return { totalDuration, skippedDuration };
}

function updateProgressBar(percentage, hoursSkipped, totalHours) {
    if (progressBarFill && progressPercentage && progressText) {
        progressBarFill.style.width = `${percentage}%`;
        progressBarFill.textContent = `${percentage}%`;
        progressPercentage.textContent = `${percentage}%`;
        progressText.textContent = `${hoursSkipped.toFixed(1)}h sur ${totalHours.toFixed(1)}h d'absence`;
    }
}
