import { base } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = __PLANIT_STATIC_BUILD__;

export const GET: RequestHandler = ({ url }) => {
	if (!__PLANIT_STORYBOOK_ENABLED__) {
		error(404, 'Not found');
	}
	// Static Storybook assets bypass the app layout and keep their own relative base.
	redirect(
		307,
		`${base}/storybook/index.html${__PLANIT_STATIC_BUILD__ ? '' : url.search}`
	);
};
