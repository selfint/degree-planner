import fs from 'fs/promises';
import path from 'path';

import { json, error } from '@sveltejs/kit';

const DB_PATH = path.resolve(process.cwd(), 'static', '_db');

export const GET = async () => {
	try {
		return json(await fs.readdir(DB_PATH));
	} catch (e) {
		// @ts-expect-error
		if (e.code === 'ENOENT') {
			return error(404, 'No years found');
		}

		return error(500, 'Internal server error');
	}
};
