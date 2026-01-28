import { appState } from './state.js';
import { openEventPopup, closeEventPopup } from './eventManager.js';
import { hashStringToHue, formatDate, getEventId } from './utils.js';

let calendarGrid, currentDateDisplay, weekRangeDisplay, monthViewBtn, weekViewBtn, monthView, weekView;

export function initView() {
    calendarGrid = document.getElementById("calendarGrid");
    currentDateDisplay = document.getElementById("currentDateDisplay");
    weekRangeDisplay = document.getElementById("weekRangeDisplay");
    monthViewBtn = document.getElementById("monthViewBtn");
    weekViewBtn = document.getElementById("weekViewBtn");
    monthView = document.getElementById("monthView");
    weekView = document.getElementById("weekView");
}

export function switchView(view) {
    appState.currentView = view;
    if (monthViewBtn && weekViewBtn) {
        monthViewBtn.classList.toggle('active', view === 'month');
        weekViewBtn.classList.toggle('active', view === 'week');
        monthView.style.display = view === 'month' ? 'block' : 'none';
        weekView.style.display = view === 'week' ? 'block' : 'none';
        updateDisplay();
    }
}

export function updateDisplay() {
    if (appState.currentView === 'month') {
        updateMonthView();
    } else {
        updateWeekView();
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
    // Si on garde l'heure actuelle (ex: 21h), la "fin de semaine" sera lundi prochain à 21h,
    // ce qui inclura les cours du lundi matin suivant !
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
                // Darkened from 90% to 80% lightness, and added border for contrast
                eventElement.style.backgroundColor = `hsla(${hue}, 70%, 80%, 0.85)`; // slightly more transparent for overlaps
                eventElement.style.borderLeft = `3px solid hsla(${hue}, 70%, 40%, 1)`;
                eventElement.style.borderRight = `1px solid hsla(${hue}, 70%, 40%, 0.2)`;
                eventElement.style.borderTop = `1px solid hsla(${hue}, 70%, 40%, 0.2)`;
                eventElement.style.borderBottom = `1px solid hsla(${hue}, 70%, 40%, 0.2)`;

                // Check if skipped
                const evId = getEventId(ev);
                if (appState.skippedEventIds.has(evId)) {
                    eventElement.style.border = "2px solid red";
                    eventElement.style.backgroundColor = "#ffe6e6"; // Light red background
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
