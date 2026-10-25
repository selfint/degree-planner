import { consolePathname } from './browserShareRoutes';

/** Full-screen startup belongs to console entry, never to its internal SPA routes. */
export function shouldShowConsoleEntry(current: string, destination?: string) {
	const isConsole = (path: string) =>
		/^\/app(?:\/|$)/.test(consolePathname(path));
	return (
		!isConsole(current) && destination !== undefined && isConsole(destination)
	);
}
