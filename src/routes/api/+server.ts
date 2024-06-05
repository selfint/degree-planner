import path from 'path';
import fs from 'fs/promises';

import { json, error } from '@sveltejs/kit';

const DB_PATH = path.join('static', '_db');

export const GET = async () => {
	try {
		return json(await fs.access(DB_PATH));
	} catch (e) {
		return error(500, JSON.stringify(e));
	}
};
