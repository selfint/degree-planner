import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	if (env.VERCEL_ENV !== 'preview' && (env.VERCEL_ENV || env.VERCEL)) {
		error(404, 'Not found');
	}
	// Static Storybook assets bypass the app layout and keep their own relative base.
	redirect(307, `/storybook/index.html${url.search}`);
};
