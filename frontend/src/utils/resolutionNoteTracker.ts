/** Совпадает с суффиксом вебхука Tracker в `resolution_note` (символ FF + маркер). */
const TRACKER_CLOSED_BY_MARKER = '\fTRACKER_CLOSED_BY:';

/**
 * Из одного поля API `resolution_note` выделяет текст резолюции и строку «кто закрыл» из Tracker.
 */
export function splitResolutionNoteFromApi(raw: string | null | undefined): {
    resolutionBody: string;
    trackerClosedBy: string | undefined;
} {
    let s = raw ?? '';
    if (!s.trim()) {
        return { resolutionBody: '', trackerClosedBy: undefined };
    }
    const needle = `\n${TRACKER_CLOSED_BY_MARKER}`;
    const li = s.lastIndexOf(needle);
    if (li !== -1) {
        const trackerClosedBy = s.slice(li + needle.length).trim() || undefined;
        const resolutionBody = s.slice(0, li).trimEnd();
        return { resolutionBody, trackerClosedBy };
    }
    if (s.startsWith(TRACKER_CLOSED_BY_MARKER)) {
        const trackerClosedBy = s.slice(TRACKER_CLOSED_BY_MARKER.length).trim() || undefined;
        return { resolutionBody: '', trackerClosedBy };
    }
    return { resolutionBody: s.trimEnd(), trackerClosedBy: undefined };
}
