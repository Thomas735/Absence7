import { appState, saveProgress } from './state.js';
import { extractCourseCode, getEventId } from './utils.js';
import { updateDisplay } from './view.js';

let eventPopup, popupTitle, popupDate, popupTime, popupDescription;
let progressBarFill, progressPercentage, progressText;
let progressBarFillCounted, progressPercentageCounted, progressTextCounted;

export function initEventPopup() {
    eventPopup = document.getElementById("eventPopup");
    popupTitle = document.getElementById("popupTitle");
    popupDate = document.getElementById("popupDate");
    popupTime = document.getElementById("popupTime");
    popupDescription = document.getElementById("popupDescription");

    progressBarFillCounted = document.getElementById("progressBarFillCounted");
    progressPercentageCounted = document.getElementById("progressPercentageCounted");
    progressTextCounted = document.getElementById("progressTextCounted");

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

    const percentageCounted = stats.totalDuration > 0 ? (stats.skippedCountedDuration / stats.totalDuration) * 100 : 0;
    const progressPercentageCountedVal = Math.min(100, Math.round(percentageCounted));

    popupTitle.textContent = title;
    popupDate.textContent = date;
    popupTime.textContent = timeDisplay;

    // Render Description with Clickable Professor Names
    popupDescription.innerHTML = ''; // Clear previous content
    if (!description || description === "Aucune description") {
        popupDescription.textContent = description;
    } else {
        const lines = description.split('\n');
        lines.forEach((line, index) => {
            const cleanLine = line.trim();
            const p = document.createElement('div');

            // Check if this line looks like a professor name (reuse heuristic logic)
            // Simple check: Not empty, not known metadata patterns
            let isMetadata = false;
            if (cleanLine.length < 3) isMetadata = true;
            if (cleanLine.startsWith("Exporté le")) isMetadata = true;
            if (cleanLine.includes("documents autorisés")) isMetadata = true;
            if (cleanLine.match(/^\d+h\d+/)) isMetadata = true;
            if (cleanLine.match(/^\d+SN-/)) isMetadata = true;
            if (cleanLine.match(/^\(/)) isMetadata = true;

            if (!isMetadata && cleanLine !== title) {
                // Assume it's a professor or relevant info -> Make Clickable
                const span = document.createElement('span');
                span.textContent = cleanLine;
                span.style.color = "#0984e3";
                span.style.textDecoration = "underline";
                span.style.cursor = "pointer";
                span.className = "prof-link";

                span.onclick = (e) => {
                    e.stopPropagation();
                    // Use GLOBAL function exposed in view.js to avoid circular dependency import
                    if (window.openProfPopup) {
                        window.openProfPopup(cleanLine);
                        closeEventPopup(); // Close event details to show prof popup
                    } else {
                        console.error("openProfPopup not found on window");
                    }
                };
                p.appendChild(span);
            } else {
                p.textContent = cleanLine;
            }
            popupDescription.appendChild(p);
        });
    }

    updateProgressBar(progressPercentageVal, stats.skippedDuration, stats.totalDuration, progressPercentageCountedVal, stats.skippedCountedDuration);

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
            const newPctCounted = newStats.totalDuration > 0 ? (newStats.skippedCountedDuration / newStats.totalDuration) * 100 : 0;

            updateProgressBar(Math.round(newPct), newStats.skippedDuration, newStats.totalDuration, Math.round(newPctCounted), newStats.skippedCountedDuration);
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
            const newPctCounted = newStats.totalDuration > 0 ? (newStats.skippedCountedDuration / newStats.totalDuration) * 100 : 0;

            updateProgressBar(Math.round(newPct), newStats.skippedDuration, newStats.totalDuration, Math.round(newPctCounted), newStats.skippedCountedDuration);
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
    let skippedCountedDuration = 0;

    appState.events.forEach(ev => {
        const code = extractCourseCode(ev.title, ev.description);
        if (code === targetCourseCode) {
            const duration = ev.end ? (ev.end - ev.start) / (1000 * 60 * 60) : 2;
            totalDuration += duration;

            const evId = getEventId(ev);
            if (appState.skippedEventIds.has(evId)) {
                skippedDuration += duration;

                // Check if this absence should be COUNTED (i.e., NO professor is unsigned)
                let isUnsigned = false;
                if (ev.description && appState.unsignedProfessors && appState.unsignedProfessors.size > 0) {
                    for (const profName of appState.unsignedProfessors) {
                        if (ev.description.includes(profName)) {
                            isUnsigned = true;
                            break;
                        }
                    }
                }

                if (!isUnsigned) {
                    skippedCountedDuration += duration;
                }
            }
        }
    });

    return { totalDuration, skippedDuration, skippedCountedDuration };
}

function updateProgressBar(percentage, hoursSkipped, totalHours, percentageCounted, hoursSkippedCounted) {
    if (progressBarFill && progressPercentage && progressText) {
        progressBarFill.style.width = `${percentage}%`;
        progressBarFill.textContent = `${percentage}%`;
        progressPercentage.textContent = `${percentage}%`;
        progressText.textContent = `${hoursSkipped.toFixed(1)}h sur ${totalHours.toFixed(1)}h d'absence`;
    }

    if (progressBarFillCounted && progressPercentageCounted && progressTextCounted) {
        progressBarFillCounted.style.width = `${percentageCounted}%`;
        progressBarFillCounted.textContent = `${percentageCounted}%`;
        progressPercentageCounted.textContent = `${percentageCounted}%`;
        progressTextCounted.textContent = `${hoursSkippedCounted.toFixed(1)}h sur ${totalHours.toFixed(1)}h comptabilisées`;
    }
}
