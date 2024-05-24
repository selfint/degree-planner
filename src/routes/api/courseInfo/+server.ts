import { error, json } from '@sveltejs/kit';
import { getName } from '$lib/server/courseName.js';

export const GET = async ({ url }) => {
	const code = url.searchParams.get('c');
	if (code === null) {
		return error(422, 'Missing c (code) query parameter');
	}

	return json(await getName(code));
};
