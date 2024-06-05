import fs from 'fs/promises';
import path from 'path';

import { json, error } from '@sveltejs/kit';

const DB_PATH = path.resolve('static', '_db');

export const GET = async ({ params: { year, faculty, plan } }) => {
	const facultyPath = path.join(DB_PATH, year, faculty, plan);

	try {
		return json(await fs.readdir(facultyPath));
	} catch (e) {
		// @ts-expect-error
		if (e.code === 'ENOENT') {
			return error(404, 'Year not found');
		}

		return error(500, 'Internal server error');
	}
};
