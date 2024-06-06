import path from 'path';
import fs from 'fs/promises';

import { json, error } from '@sveltejs/kit';

export const GET = async ({ url }) => {
	const p = (url.searchParams.get('p') || '.').split(',');
	try {
		return json(await fs.readdir(path.join(process.cwd(), ...p)));
	} catch (e) {
		return error(500, JSON.stringify(e));
	}
};
