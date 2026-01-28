import { appState } from './state.js';
import { updateDisplay } from './view.js';
import { parseICSTime } from './utils.js';

export function parseICS(data) {
    appState.events = [];
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
                if (!event.end && event.start) {
                    event.end = new Date(event.start.getTime() + 2 * 60 * 60 * 1000);
                }
                appState.events.push(event);
            }
            event = null;
            inEvent = false;
            currentField = '';
        } else if (inEvent) {
            if (line.startsWith(" ")) {
                if (currentField === 'description' && event.description) {
                    event.description += line.substring(1);
                }
            } else {
                if (line.startsWith("DTSTART")) {
                    event.start = parseICSTime(line.split(":")[1]);
                    currentField = '';
                } else if (line.startsWith("DTEND")) {
                    event.end = parseICSTime(line.split(":")[1]);
                    currentField = '';
                } else if (line.startsWith("SUMMARY")) {
                    // Handle titles with colons
                    const firstColon = line.indexOf(':');
                    event.title = line.substring(firstColon + 1) || 'Sans titre';
                    currentField = '';
                } else if (line.startsWith("DESCRIPTION")) {
                    // Handle descriptions with colons
                    const firstColon = line.indexOf(':');
                    let rawDescription = line.substring(firstColon + 1) || '';
                    event.description = rawDescription.replace(/\\n/g, '\n').replace(/\\/g, '');
                    currentField = 'description';
                } else {
                    currentField = '';
                }
            }
        }
    });

    // Post-process descriptions to ensure cleanness
    appState.events.forEach(ev => {
        if (ev.description) {
            // Replace literal \n with newline and clean up other escapes
            ev.description = ev.description.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\/g, '');
        }
    });

    updateDisplay();
}
