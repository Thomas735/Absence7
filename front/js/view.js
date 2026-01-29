import { appState, saveProgress } from './state.js';
import { openEventPopup, closeEventPopup } from './eventManager.js';
import { hashStringToHue, formatDate, getEventId } from './utils.js';

let calendarGrid, currentDateDisplay, weekRangeDisplay, monthViewBtn, weekViewBtn, monthView, weekView, professorsView, professorsList, prevBtn, nextBtn, calendarTitleDisplay;
let profPopup, profPopupTitle, profSignBtn, profUnsignBtn, closeProfPopupBtn;
let currentSelectedProf = null;

export function initView() {
    calendarGrid = document.getElementById("calendarGrid");
    currentDateDisplay = document.getElementById("currentDateDisplay");
    weekRangeDisplay = document.getElementById("weekRangeDisplay");
    monthViewBtn = document.getElementById("monthViewBtn");
    weekViewBtn = document.getElementById("weekViewBtn");
    calendarTitleDisplay = document.getElementById("calendarTitleDisplay");
    monthView = document.getElementById("monthView");
    weekView = document.getElementById("weekView");
    professorsView = document.getElementById("professorsView");
    professorsList = document.getElementById("professorsList");
    prevBtn = document.getElementById("prevBtn");
    nextBtn = document.getElementById("nextBtn");

    // Popup Elements
    profPopup = document.getElementById("profPopup");
    profPopupTitle = document.getElementById("profPopupTitle");
    profSignBtn = document.getElementById("profSignBtn");
    profUnsignBtn = document.getElementById("profUnsignBtn");
    closeProfPopupBtn = document.getElementById("closeProfPopup");

    // Popup Listeners
    if (closeProfPopupBtn) {
        closeProfPopupBtn.addEventListener("click", () => profPopup.style.display = 'none');
    }
    if (profSignBtn) {
        profSignBtn.addEventListener("click", () => toggleProfessorSignature(true));
    }
    if (profUnsignBtn) {
        profUnsignBtn.addEventListener("click", () => toggleProfessorSignature(false));
    }

    // Close on click outside
    window.addEventListener("click", (e) => {
        if (e.target === profPopup) {
            profPopup.style.display = 'none';
        }
    });

    // EXPOSE TO GLOBAL SCOPE to avoid circular dependencies with eventManager.js
    window.openProfPopup = openProfPopup;
}

export function switchView(view) {
    appState.currentView = view;

    // TRACK DATA CONTEXT
    if (view === 'month' || view === 'week') {
        appState.lastCalendarView = view;
    }

    if (monthViewBtn && weekViewBtn) {
        monthViewBtn.classList.toggle('active', view === 'month');
        weekViewBtn.classList.toggle('active', view === 'week');

        // Hide all first
        if (monthView) monthView.style.display = 'none';
        if (weekView) weekView.style.display = 'none';
        if (professorsView) professorsView.style.display = 'none';

        // Show selected
        if (view === 'month' && monthView) {
            monthView.style.display = 'block';
            updateMonthView();
        } else if (view === 'week' && weekView) {
            weekView.style.display = 'block';
            updateWeekView();
        } else if (view === 'professors' && professorsView) {
            professorsView.style.display = 'block';
            renderProfessors();
        }
    }
}

export function updateDisplay() {
    switchView(appState.currentView);
    if (calendarTitleDisplay) {
        const currentCal = appState.calendars.find(c => c.id === appState.currentCalendarId);
        if (currentCal) {
            calendarTitleDisplay.textContent = currentCal.name;
        } else {
            calendarTitleDisplay.textContent = "Mon Calendrier";
        }
    }
}

function updateMonthView() {
    const year = appState.currentDate.getFullYear();
    const month = appState.currentDate.getMonth();
    currentDateDisplay.textContent = new Date(year, month, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    renderCalendar(year, month);
}

function updateWeekView() {
    const startOfWeek = new Date(appState.currentDate);
    // IMPORTANTE : On remet l'heure à 00:00:00 du matin pour éviter les décalages
    startOfWeek.setHours(0, 0, 0, 0);

    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    weekRangeDisplay.textContent = `Semaine du ${formatDate(startOfWeek)} au ${formatDate(endOfWeek)}`;
    currentDateDisplay.textContent = `Semaine du ${formatDate(startOfWeek)}`;

    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const dayHeaders = document.querySelectorAll('.jour');

    const currentDay = new Date(startOfWeek);
    dayHeaders.forEach((header, index) => {
        header.textContent = `${days[index]} ${currentDay.getDate()}`;
        currentDay.setDate(currentDay.getDate() + 1);
    });

    renderWeekEvents(startOfWeek);
}


function toggleProfessorSignature(isSigned) {
    if (!currentSelectedProf) return;

    // Ensure Set exists using fallback logic
    if (!appState.unsignedProfessors) {
        appState.unsignedProfessors = new Set();
    }

    if (isSigned) {
        // "Fait signer" -> Remove from the "Not Signed" list (return to normal)
        appState.unsignedProfessors.delete(currentSelectedProf);
    } else {
        // "Ne fait pas signer" -> Add to the "Not Signed" list (trigger warning)
        appState.unsignedProfessors.add(currentSelectedProf);
    }

    saveProgress();
    profPopup.style.display = 'none';
    updateDisplay(); // Re-render CURRENT view (Calendar or Professors) to update UI immediately
}

function openProfPopup(name) {
    currentSelectedProf = name;
    profPopupTitle.textContent = name;
    profPopup.style.display = 'flex';
}

function renderProfessors() {
    if (!professorsList) return;
    professorsList.innerHTML = '';

    // FILTER EVENTS BY DATE RANGE
    let startDate, endDate;
    const viewMode = appState.lastCalendarView || 'week'; // Default to week logic

    if (viewMode === 'month') {
        const year = appState.currentDate.getFullYear();
        const month = appState.currentDate.getMonth();
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0, 23, 59, 59);
    } else {
        // Week Logic
        const startOfWeek = new Date(appState.currentDate);
        startOfWeek.setHours(0, 0, 0, 0);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff); // Monday

        startDate = new Date(startOfWeek);
        endDate = new Date(startOfWeek);
        endDate.setDate(startDate.getDate() + 7); // Following Monday
    }

    const filteredEvents = appState.events.filter(ev => {
        return ev.start >= startDate && ev.start < endDate;
    });

    // Extraction Logic
    const professors = new Map(); // Name -> Set of Courses

    filteredEvents.forEach(ev => {
        if (!ev.description) return;

        const lines = ev.description.split('\n');

        lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.length < 3) return;
            if (cleanLine.startsWith("Exporté le")) return;
            if (cleanLine.includes("documents autorisés")) return;
            if (cleanLine.match(/^\d+h\d+/)) return;
            if (cleanLine.match(/^\d+SN-/)) return;
            if (cleanLine.match(/^\(/)) return;

            if (cleanLine !== ev.title) {
                if (!professors.has(cleanLine)) {
                    professors.set(cleanLine, new Set());
                }
                professors.get(cleanLine).add(ev.title);
            }
        });
    });

    if (professors.size === 0) {
        professorsList.innerHTML = `<p>Aucun professeur trouvé pour cette période (${viewMode === 'month' ? 'Mois' : 'Semaine'}).</p>`;
        return;
    }

    professors.forEach((courses, name) => {
        const card = document.createElement('div');
        card.className = 'prof-card';

        // CHECK UNSIGNED STATUS
        if (appState.unsignedProfessors && appState.unsignedProfessors.has(name)) {
            card.classList.add('unsigned');
            // Add a visual indicator for "Not Signed" (e.g. Warning Icon)
            card.innerHTML += `<div style="position: absolute; top: 10px; right: 10px; color: #e74c3c; font-weight: bold; font-size: 1.2rem;">⚠️</div>`;
            card.style.borderLeft = "5px solid #e74c3c";
            card.style.backgroundColor = "#fff0f0";
        }

        const courseList = Array.from(courses).slice(0, 3).join(', ') + (courses.size > 3 ? '...' : '');

        card.innerHTML += `
            <div class="prof-name">${name}</div>
            <div class="prof-course">${courses.size} cours : ${courseList}</div>
        `;

        // ADD CLICK EVENT
        card.addEventListener('click', () => openProfPopup(name));
        card.style.cursor = 'pointer';

        professorsList.appendChild(card);
    });
}

function renderCalendar(year, month) {
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const daysInMonth = lastDay.getDate();

    for (let i = 0; i < 42; i++) {
        const dayElement = document.createElement('div');
        const dayNumber = i - firstDayOfWeek + 1;

        if (dayNumber > 0 && dayNumber <= daysInMonth) {
            dayElement.className = 'calendar-day';
            dayElement.innerHTML = `<div class="day-number">${dayNumber}</div><div class="day-events"></div>`;

            // NAVIGATION: Click on day navigates to that Week
            const clickedDate = new Date(year, month, dayNumber);
            dayElement.addEventListener('click', (e) => {
                // Prevent navigation if clicking on a specific event (handled by event listeners below)
                if (e.target.closest('.event')) return;

                appState.currentDate = clickedDate;
                switchView('week');
                updateDisplay(); // Ensure full refresh
            });
            dayElement.style.cursor = 'pointer';

            const dayEvents = appState.events.filter(event => {
                const eventDate = event.start;
                return eventDate.getDate() === dayNumber &&
                    eventDate.getMonth() === month &&
                    eventDate.getFullYear() === year;
            });

            dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

            const eventsContainer = dayElement.querySelector('.day-events');
            const maxEventsToShow = 4;

            dayEvents.slice(0, maxEventsToShow).forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'event';

                // Check if skipped
                const evId = getEventId(event);
                if (appState.skippedEventIds.has(evId)) {
                    eventElement.classList.add('skipped');
                    eventElement.style.borderLeft = "2px solid red";
                }

                const timeString = event.start.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let title = event.title;
                if (title.length > 20) {
                    title = title.substring(0, 17) + '...';
                }

                eventElement.innerHTML = `<span class="event-time">${timeString}</span> ${title}`;
                eventsContainer.appendChild(eventElement);
            });

            if (dayEvents.length > maxEventsToShow) {
                const moreEventsElement = document.createElement('div');
                moreEventsElement.className = 'event';
                moreEventsElement.textContent = `+ ${dayEvents.length - maxEventsToShow} autre(s)`;
                moreEventsElement.style.fontStyle = 'italic';
                eventsContainer.appendChild(moreEventsElement);
            }

            const today = new Date();
            if (dayNumber === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear()) {
                dayElement.classList.add('today');
            }
        } else {
            dayElement.className = 'calendar-day other-month';
            if (dayNumber <= 0) {
                const prevMonth = month - 1 < 0 ? 11 : month - 1;
                const prevYear = month - 1 < 0 ? year - 1 : year;
                const lastDayPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
                dayElement.innerHTML = `<div class="day-number">${lastDayPrevMonth + dayNumber}</div>`;
            } else {
                dayElement.innerHTML = `<div class="day-number">${dayNumber - daysInMonth}</div>`;
            }
        }
        calendarGrid.appendChild(dayElement);
    }
}

function renderWeekEvents(startOfWeek) {
    const cases = document.querySelectorAll('.case');
    cases.forEach(cell => {
        cell.innerHTML = ''; // Clear content
        cell.classList.remove('active');
        cell.style.backgroundColor = '';
        cell.onclick = null;
    });

    // Default click handler for empty cells
    cases.forEach(cell => {
        cell.onclick = function () {
            closeEventPopup();
        };
    });

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekEvents = appState.events.filter(event => {
        const eventDate = event.start;
        return eventDate >= startOfWeek && eventDate < endOfWeek;
    });

    // Sort: Earliest start first. If same start, Longest duration first (background).
    weekEvents.sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;
        const durationA = (a.end || a.start) - a.start;
        const durationB = (b.end || b.start) - b.start;
        return durationB - durationA; // Longest first
    });

    weekEvents.forEach((ev, index) => {
        if (!ev.start) return;

        const day = ev.start.getDay();
        const hour = ev.start.getHours();
        const minutes = ev.start.getMinutes();
        const adjustedDay = day === 0 ? 7 : day;

        // Calculate duration in minutes
        let durationMinutes = 120; // Default 2 hours
        if (ev.end) {
            const diffMs = ev.end - ev.start;
            durationMinutes = Math.floor(diffMs / 60000);
        }

        if (hour >= 8 && hour <= 20) {
            const selector = `.case[data-hour="${hour}"][data-day="${adjustedDay}"]`;
            const cell = document.querySelector(selector);

            if (cell) {
                const timeString = ev.start.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                let title = ev.title;
                // Longer truncation since we might have more height
                if (title.length > 50) {
                    title = title.substring(0, 47) + '...';
                }

                const eventElement = document.createElement('div');
                eventElement.className = 'week-event';
                eventElement.innerHTML = `<strong>${timeString}</strong> <span>${title}</span>`;

                // Calculate positioning and size
                // 1 hour = 50px height
                const pixelsPerHour = 50;
                const topOffset = (minutes / 60) * pixelsPerHour;
                const height = (durationMinutes / 60) * pixelsPerHour;

                eventElement.style.top = `${topOffset}px`;
                eventElement.style.height = `${height}px`;

                // Allow stacking by giving later items higher z-index if needed, or rely on DOM order
                // With our sort (Longest First), Shorter ones (rendered later) will be on top.
                // We can add a base z-index to ensure they are above grid lines if any.
                eventElement.style.zIndex = '5';

                // Color based on title hash
                const hue = hashStringToHue(ev.title);
                let bgColor = `hsla(${hue}, 70%, 80%, 0.85)`;
                let borderColor = `hsla(${hue}, 70%, 40%, 1)`;

                // CHECK IF PROFESSOR IS UNSIGNED
                if (ev.description && appState.unsignedProfessors) {
                    // We need to check if ANY professor associated with this event is in the unsigned list
                    // We use the same extraction logic "on the fly" or just check string inclusion for speed
                    // Optimally, we iterate the Set and check if description contains the name
                    for (const profName of appState.unsignedProfessors) {
                        if (ev.description.includes(profName)) {
                            // Override color for Not Signed
                            bgColor = "#e74c3c"; // Red/Orange
                            borderColor = "#c0392b";
                            eventElement.style.color = "white"; // White text for better contrast on red
                            break;
                        }
                    }
                }

                eventElement.style.backgroundColor = bgColor;
                eventElement.style.borderLeft = `3px solid ${borderColor}`;
                eventElement.style.borderRight = `1px solid ${borderColor}`; // simplify border
                eventElement.style.borderTop = `1px solid ${borderColor}`;
                eventElement.style.borderBottom = `1px solid ${borderColor}`;

                // Check if skipped (override again if strict)
                const evId = getEventId(ev);
                if (appState.skippedEventIds.has(evId)) {
                    eventElement.style.border = "2px solid red";
                    eventElement.style.backgroundColor = "#ffe6e6"; // Light red background
                    eventElement.style.color = "black"; // Reset text color
                }

                // Add click event
                eventElement.onclick = function (e) {
                    e.stopPropagation();
                    openEventPopup(ev);

                    // Visual feedback on click
                    document.querySelectorAll('.week-event').forEach(el => el.style.zIndex = '10');
                    eventElement.style.zIndex = '20';
                };

                cell.appendChild(eventElement);
            }
        }
    });
}
