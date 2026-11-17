import { redirectConsoleEntry } from '$lib/consoleEntry';
export const trailingSlash = 'always';
// The parent handles cold entry; this handles /app/ in an already-mounted shell.
export const load = redirectConsoleEntry;
