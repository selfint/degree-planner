import fs from 'fs/promises';
import path from 'path';

import { json, error } from '@sveltejs/kit';

const DB_PATH = path.resolve(process.cwd(), 'static', '_db');

export const GET = async () => {
	try {
		console.log(['GET', 'DB_PATH', DB_PATH]);
		const years = await fs.readdir(DB_PATH);
		console.log(['GET', 'years', years]);
		return json(years);
	} catch (e) {
		console.error(e);

		// @ts-expect-error
		if (e.code === 'ENOENT') {
			return error(404, JSON.stringify(e));
		}

		return error(500, 'Internal server error');
	}
};
