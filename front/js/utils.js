export function hashStringToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash % 360;
}

export function formatDate(date) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

export function extractCourseCode(title, description) {
    const codeMatch = title.match(/\b[A-Z0-9]{6,8}\b/) ||
        (description || "").match(/\b[A-Z0-9]{6,8}\b/);

    if (codeMatch) {
        return codeMatch[0];
    }
    return title; // Use title if no code found
}

// CORRECTED TIME PARSING
export function parseICSTime(str) {
    // Check if it ends in Z (UTC)
    const isUTC = str.endsWith('Z');

    if (str.includes('T')) {
        // 20251105T070000Z
        // Remove Z if present for regex match
        const cleanStr = str.replace('Z', '');
        const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
        if (!match) return null;

        const [_, year, month, day, hour, minute, second] = match;

        if (isUTC) {
            // Parse as UTC
            return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
        } else {
            // Parse as Local Time (no Z appended)
            // Note: new Date("2025-11-05T07:00:00") is local
            return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        }
    } else {
        // Date only (all day)
        const match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (!match) return null;

        const [_, year, month, day] = match;
        return new Date(year, month - 1, day);
    }
}

export function getEventId(event) {
    // Create a unique ID for the event instance
    // Using course code + timestamp helps uniqueness
    const courseCode = extractCourseCode(event.title, event.description);
    return `${courseCode}_${event.start.getTime()}`;
}
