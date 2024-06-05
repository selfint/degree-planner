import path from 'path';

import { json } from '@sveltejs/kit';

const DB_PATH = path.resolve(process.cwd(), 'static', '_db');

export const GET = async () => {
	return json(DB_PATH);
};
