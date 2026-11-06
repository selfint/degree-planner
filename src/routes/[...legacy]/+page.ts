import { error, redirect } from '@sveltejs/kit';
import { legacyConsoleDestination } from '$lib/consoleRoutes';
export const load = ({ url }) => {
	const destination = legacyConsoleDestination(url);
	if (destination) redirect(307, destination);
	error(404, 'Not found');
};
