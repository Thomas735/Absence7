document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("btn");
  const fileInput = document.getElementById("fileInput");
  const calendarGrid = document.getElementById("calendarGrid");
  const currentDateDisplay = document.getElementById("currentDateDisplay");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const monthViewBtn = document.getElementById("monthViewBtn");
  const weekViewBtn = document.getElementById("weekViewBtn");
  const monthView = document.getElementById("monthView");
  const weekView = document.getElementById("weekView");
  const prevWeekBtn = document.getElementById("prevWeekBtn");
  const nextWeekBtn = document.getElementById("nextWeekBtn");
  const weekRangeDisplay = document.getElementById("weekRangeDisplay");

  let currentDate = new Date();
  let events = [];
  let currentView = 'month'; // 'month' or 'week'
  let eventPopup;
  let popupTitle, popupDate, popupTime, popupDescription;
  let closePopupBtn;
  let eventProgress = {};
  let courseTotals = {}; // Pour stocker le total d'heures par code de cours

  // Initialisation
  loadProgress();
  updateDisplay();
  initEventPopup();
  
  // Navigation
  prevBtn.addEventListener("click", () => {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() - 7);
    }
    updateDisplay();
  });

  nextBtn.addEventListener("click", () => {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 7);
    }
    updateDisplay();
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
    currentDate.setDate(currentDate.getDate() - 7);
    updateDisplay();
  });

  nextWeekBtn.addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() + 7);
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      console.log("Contenu ICS (début):", content.substring(0, 500));
      parseICS(content);
    };
    reader.readAsText(file);
  });

  function initEventPopup() {
    eventPopup = document.getElementById("eventPopup");
    popupTitle = document.getElementById("popupTitle");
    popupDate = document.getElementById("popupDate");
    popupTime = document.getElementById("popupTime");
    popupDescription = document.getElementById("popupDescription");
    closePopupBtn = document.querySelector(".close-popup");
    
    // Fermer la popup quand on clique sur la croix
    closePopupBtn.addEventListener("click", closeEventPopup);
    
    // Fermer la popup quand on clique en dehors du contenu
    eventPopup.addEventListener("click", function(event) {
      if (event.target === eventPopup) {
        closeEventPopup();
      }
    });
    
    // Fermer la popup avec la touche Échap
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closeEventPopup();
      }
    });
  }

  function openEventPopup(event) {
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
    
    // Calculer la durée du cours en heures
    const duration = event.end ? (event.end - event.start) / (1000 * 60 * 60) : 2; // Par défaut 2h si pas de end time
    
    // Trouver le code du cours dans le titre ou la description
    const courseCode = extractCourseCode(event.title, event.description);
    
    // Initialiser la progression si elle n'existe pas
    const eventId = `${courseCode}_${event.start.getTime()}`;
    if (!eventProgress[eventId]) {
      // Utiliser le total calculé pour ce cours, ou 10h par défaut si non trouvé
      const totalHours = courseTotals[courseCode] || 10;
      
      eventProgress[eventId] = {
        hoursSkipped: 0,
        totalHours: totalHours,
        duration: duration,
        courseCode: courseCode
      };
    }
    
    // Calculer le pourcentage de progression
    const progress = (eventProgress[eventId].hoursSkipped / eventProgress[eventId].totalHours) * 100;
    const progressPercentage = Math.min(100, Math.round(progress));
    
    popupTitle.textContent = title;
    popupDate.textContent = date;
    popupTime.textContent = timeDisplay;
    popupDescription.textContent = description;
    
    // Mettre à jour la barre de progression
    updateProgressBar(progressPercentage, eventProgress[eventId].hoursSkipped, eventProgress[eventId].totalHours);
    
    // Configurer le bouton "Je sèche"
    const skipButton = document.getElementById("skipButton");
    skipButton.onclick = function() {
      // Ajouter la durée du cours aux heures skipped
      eventProgress[eventId].hoursSkipped += duration;
      
      // Recalculer le pourcentage
      const newProgress = (eventProgress[eventId].hoursSkipped / eventProgress[eventId].totalHours) * 100;
      const newProgressPercentage = Math.min(100, Math.round(newProgress));
      
      // Mettre à jour la barre de progression
      updateProgressBar(newProgressPercentage, eventProgress[eventId].hoursSkipped, eventProgress[eventId].totalHours);
      
      // Sauvegarder la progression dans le localStorage
      saveProgress();
    };
    
    // Configurer le bouton "Je n'ai pas séché"
    const unskipButton = document.getElementById("unskipButton");
    unskipButton.onclick = function() {
      // Retirer la durée du cours aux heures skipped (mais pas en dessous de 0)
      eventProgress[eventId].hoursSkipped = Math.max(0, eventProgress[eventId].hoursSkipped - duration);
      
      // Recalculer le pourcentage
      const newProgress = (eventProgress[eventId].hoursSkipped / eventProgress[eventId].totalHours) * 100;
      const newProgressPercentage = Math.min(100, Math.round(newProgress));
      
      // Mettre à jour la barre de progression
      updateProgressBar(newProgressPercentage, eventProgress[eventId].hoursSkipped, eventProgress[eventId].totalHours);
      
      // Sauvegarder la progression dans le localStorage
      saveProgress();
    };
    
    eventPopup.style.display = "block";
    document.body.style.overflow = "hidden"; // Empêcher le défilement
  }

  function closeEventPopup() {
    eventPopup.style.display = "none";
    document.body.style.overflow = ""; // Rétablir le défilement
  }

  // Fonction pour extraire le code de cours du titre ou de la description
  function extractCourseCode(title, description) {
    // Chercher un code de cours dans le titre (format: N7EN07A ou similaire)
    const codeMatch = title.match(/\b[A-Z0-9]{6,8}\b/) || 
                     (description || "").match(/\b[A-Z0-9]{6,8}\b/);
    
    if (codeMatch) {
      return codeMatch[0];
    }
    
    // Si aucun code n'est trouvé, utiliser le titre comme identifiant
    return title;
  }

  // Fonction pour mettre à jour la barre de progression
  function updateProgressBar(percentage, hoursSkipped, totalHours) {
    const progressBarFill = document.getElementById("progressBarFill");
    const progressPercentage = document.getElementById("progressPercentage");
    const progressText = document.getElementById("progressText");
    
    progressBarFill.style.width = `${percentage}%`;
    progressBarFill.textContent = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;
    progressText.textContent = `${hoursSkipped.toFixed(1)}h sur ${totalHours.toFixed(1)}h d'absence`;
  }

  // Fonction pour sauvegarder la progression dans le localStorage
  function saveProgress() {
    localStorage.setItem('eventProgress', JSON.stringify(eventProgress));
  }

  // Fonction pour charger la progression depuis le localStorage
  function loadProgress() {
    const savedProgress = localStorage.getItem('eventProgress');
    if (savedProgress) {
      eventProgress = JSON.parse(savedProgress);
    }
  }

  function switchView(view) {
    currentView = view;
    
    // Mettre à jour les boutons de vue
    monthViewBtn.classList.toggle('active', view === 'month');
    weekViewBtn.classList.toggle('active', view === 'week');
    
    // Afficher la vue appropriée
    monthView.style.display = view === 'month' ? 'block' : 'none';
    weekView.style.display = view === 'week' ? 'block' : 'none';
    
    updateDisplay();
  }

  function updateDisplay() {
    if (currentView === 'month') {
      updateMonthView();
    } else {
      updateWeekView();
    }
  }

  function updateMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    currentDateDisplay.textContent = new Date(year, month, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    
    renderCalendar(year, month);
  }

  function updateWeekView() {
    // Calculer le début de la semaine (lundi)
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Ajustement pour que lundi soit le premier jour
    startOfWeek.setDate(diff);
    
    // Calculer la fin de la semaine (dimanche)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Mettre à jour l'affichage de la plage de dates
    weekRangeDisplay.textContent = `Semaine du ${formatDate(startOfWeek)} au ${formatDate(endOfWeek)}`;
    
    // Mettre à jour l'affichage principal
    currentDateDisplay.textContent = `Semaine du ${formatDate(startOfWeek)}`;
    
    // Mettre à jour les jours de la semaine
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const dayHeaders = document.querySelectorAll('.jour');
    
    const currentDay = new Date(startOfWeek);
    dayHeaders.forEach((header, index) => {
      header.textContent = `${days[index]} ${currentDay.getDate()}`;
      currentDay.setDate(currentDay.getDate() + 1);
    });
    
    // Afficher les événements de la semaine
    renderWeekEvents(startOfWeek);
  }

  function formatDate(date) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  function renderCalendar(year, month) {
    // Vider le calendrier
    calendarGrid.innerHTML = '';
    
    // Premier jour du mois
    const firstDay = new Date(year, month, 1);
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);
    
    // Jour de la semaine du premier jour (0 = dimanche, 1 = lundi, etc.)
    let firstDayOfWeek = firstDay.getDay();
    // Ajuster pour que lundi soit le premier jour (0 = lundi)
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Nombre de jours dans le mois
    const daysInMonth = lastDay.getDate();
    
    // Créer les cases du calendrier (6 semaines maximum)
    for (let i = 0; i < 42; i++) {
      const dayElement = document.createElement('div');
      
      // Calculer la date à afficher
      const dayNumber = i - firstDayOfWeek + 1;
      
      if (dayNumber > 0 && dayNumber <= daysInMonth) {
        // Jour du mois en cours
        dayElement.className = 'calendar-day';
        dayElement.innerHTML = `<div class="day-number">${dayNumber}</div><div class="day-events"></div>`;
        
        // Ajouter les événements pour ce jour
        const dayEvents = events.filter(event => {
          const eventDate = event.start;
          return eventDate.getDate() === dayNumber && 
                 eventDate.getMonth() === month && 
                 eventDate.getFullYear() === year;
        });
        
        // TRIER les événements par heure de début
        dayEvents.sort((a, b) => {
          return a.start.getTime() - b.start.getTime();
        });
        
        const eventsContainer = dayElement.querySelector('.day-events');
        
        // Limiter à 4 événements visibles pour ne pas surcharger l'interface
        const maxEventsToShow = 4;
        dayEvents.slice(0, maxEventsToShow).forEach(event => {
          const eventElement = document.createElement('div');
          eventElement.className = 'event';
          
          // Ajouter l'heure de l'événement
          const timeString = event.start.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          // Formater le titre pour qu'il tienne sur une ligne
          let title = event.title;
          if (title.length > 20) {
            title = title.substring(0, 17) + '...';
          }
          
          eventElement.innerHTML = `<span class="event-time">${timeString}</span> ${title}`;
          eventsContainer.appendChild(eventElement);
        });
        
        // Afficher un indicateur s'il y a plus d'événements
        if (dayEvents.length > maxEventsToShow) {
          const moreEventsElement = document.createElement('div');
          moreEventsElement.className = 'event';
          moreEventsElement.textContent = `+ ${dayEvents.length - maxEventsToShow} autre(s)`;
          moreEventsElement.style.fontStyle = 'italic';
          eventsContainer.appendChild(moreEventsElement);
        }
        
        // Stocker la date complète comme attribut de données
        dayElement.dataset.date = new Date(year, month, dayNumber).toISOString();
        
        // Ajouter un tooltip avec la date complète
        dayElement.title = new Date(year, month, dayNumber).toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Vérifier si c'est aujourd'hui
        const today = new Date();
        if (dayNumber === today.getDate() && 
            month === today.getMonth() && 
            year === today.getFullYear()) {
          dayElement.classList.add('today');
        }
      } else {
        // Jour du mois précédent ou suivant
        dayElement.className = 'calendar-day other-month';
        
        if (dayNumber <= 0) {
          // Mois précédent
          const prevMonth = month - 1 < 0 ? 11 : month - 1;
          const prevYear = month - 1 < 0 ? year - 1 : year;
          const lastDayPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
          
          dayElement.innerHTML = `<div class="day-number">${lastDayPrevMonth + dayNumber}</div>`;
        } else {
          // Mois suivant
          dayElement.innerHTML = `<div class="day-number">${dayNumber - daysInMonth}</div>`;
        }
      }
      
      calendarGrid.appendChild(dayElement);
    }
  }

  function renderWeekEvents(startOfWeek) {
    // Réinitialiser toutes les cases
    const cases = document.querySelectorAll('.case');
    cases.forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('active');
      cell.style.backgroundColor = '';
      cell.onclick = null; // Supprimer les anciens écouteurs
    });
    
    // Filtrer les événements de la semaine en cours
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    const weekEvents = events.filter(event => {
      const eventDate = event.start;
      return eventDate >= startOfWeek && eventDate < endOfWeek;
    });
    
    // TRIER les événements par date et heure
    weekEvents.sort((a, b) => {
      return a.start.getTime() - b.start.getTime();
    });
    
    // Afficher les événements dans la grille hebdomadaire
    weekEvents.forEach(ev => {
      if (!ev.start) return;
      
      const day = ev.start.getDay();    // 0=dim, 1=lun, ...
      const hour = ev.start.getHours(); // heure locale
      const minutes = ev.start.getMinutes();
      
      // CORRECTION: Ajuster le jour pour que lundi=1, dimanche=0
      // En JavaScript, getDay() retourne 0 pour dimanche, 1 pour lundi, etc.
      // Nos cases ont data-day="1" pour lundi, data-day="2" pour mardi, etc.
      const adjustedDay = day === 0 ? 7 : day; // Dimanche devient 7, lundi reste 1
      
      // On affiche seulement si dans la plage [8h - 20h]
      if (hour >= 8 && hour <= 20) {
        const selector = `.case[data-hour="${hour}"][data-day="${adjustedDay}"]`;
        const cell = document.querySelector(selector);
        
        if (cell) {
          const timeString = ev.start.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          // Formater le titre pour qu'il tienne dans la case
          let title = ev.title;
          if (title.length > 15) {
            title = title.substring(0, 12) + '...';
          }
          
          // Créer un élément pour l'événement
          const eventElement = document.createElement('div');
          eventElement.className = 'week-event';
          eventElement.innerHTML = `<span class="event-time">${timeString}</span> ${title}`;
          
          // Ajouter l'événement à la case
          cell.appendChild(eventElement);
          cell.classList.add('active');
          
          // Ajouter un écouteur de clic pour afficher les détails
          cell.onclick = function(e) {
            e.stopPropagation(); // Empêcher la propagation du clic
            openEventPopup(ev);
          };
          
          // Appliquer une couleur de fond différente selon le type d'événement
          if (!cell.style.backgroundColor) {
            const hue = hashStringToHue(ev.title);
            cell.style.backgroundColor = `hsla(${hue}, 70%, 80%, 0.7)`;
          }
        }
      }
    });
    
    // Ajouter un écouteur de clic pour les cases vides (les fermer)
    cases.forEach(cell => {
      if (!cell.onclick) {
        cell.onclick = function() {
          closeEventPopup();
        };
      }
    });
  }

  // Fonction utilitaire pour générer une teinte à partir d'une chaîne
  function hashStringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash % 360;
  }

  /**
   * Parse un fichier ICS et récupère les événements
   */
  function parseICS(data) {
    events = [];
    courseTotals = {}; // Réinitialiser les totaux de cours
    const lines = data.split(/\r?\n/);

    let event = null;
    let inEvent = false;
    let currentField = '';
    
    lines.forEach(line => {
      if (line.startsWith("BEGIN:VEVENT")) {
        event = {};
        inEvent = true;
      } else if (line.startsWith("END:VEVENT")) {
        if (event && Object.keys(event).length > 0) {
          // Si l'événement n'a pas de end time, calculer une durée par défaut
          if (!event.end && event.start) {
            // Ajouter 2 heures par défaut
            event.end = new Date(event.start.getTime() + 2 * 60 * 60 * 1000);
          }
          
          // Calculer la durée du cours
          const duration = event.end ? (event.end - event.start) / (1000 * 60 * 60) : 2;
          
          // Extraire le code du cours
          const courseCode = extractCourseCode(event.title, event.description);
          
          // Ajouter la durée au total pour ce cours
          if (!courseTotals[courseCode]) {
            courseTotals[courseCode] = 0;
          }
          courseTotals[courseCode] += duration;
          
          events.push(event);
          console.log("Événement détecté :", event);
        }
        event = null;
        inEvent = false;
        currentField = '';
      } else if (inEvent) {
        // Gestion des lignes multilignes
        if (line.startsWith(" ")) {
          // Suite d'un champ multiligne
          if (currentField === 'description' && event.description) {
            event.description += line.substring(1);
          }
        } else {
          // Nouveau champ
          if (line.startsWith("DTSTART")) {
            event.start = parseICSTime(line.split(":")[1]);
            currentField = '';
          } else if (line.startsWith("DTEND")) {
            event.end = parseICSTime(line.split(":")[1]);
            currentField = '';
          } else if (line.startsWith("SUMMARY")) {
            event.title = line.split(":")[1] || 'Sans titre';
            currentField = '';
          } else if (line.startsWith("DESCRIPTION")) {
            event.description = line.split(":")[1] || '';
            currentField = 'description';
          } else {
            currentField = '';
          }
        }
      }
    });

    console.log("Tous les événements :", events);
    console.log("Totaux par cours :", courseTotals);
    updateDisplay();
  }

  /**
   * Convertit une date ICS (ex: 20251105T070000Z) en objet Date JS
   */
  function parseICSTime(str) {
    // Formats possibles: 20251105T070000Z ou 20251105
    if (str.includes('T')) {
      // Format avec heure
      const match = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
      if (!match) return null;

      const [_, year, month, day, hour, minute, second] = match;
      const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      return new Date(isoString);
    } else {
      // Format sans heure (événement toute la journée)
      const match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (!match) return null;

      const [_, year, month, day] = match;
      return new Date(year, month - 1, day);
    }
  }
});