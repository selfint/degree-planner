import { readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'static', '_catalogs');
const MANIFEST_PATH = join(process.cwd(), 'static', 'catalogs.json');

function parseI18N(path) {
	const en = readFileSync(join(path, 'en')).toString();
	const he = readFileSync(join(path, 'he')).toString();

	return {
		en,
		he
	};
}

function parseDir(path, depth) {
	if (depth === 0) {
		return {
			...parseI18N(path)
		};
	}

	const subdirs = readdirSync(path)
		.filter((s) => !['en', 'he'].includes(s))
		.map((s) => [s, parseDir(join(path, s), depth - 1)]);

	return {
		...parseI18N(path),
		...Object.fromEntries(subdirs)
	};
}

function parseDB(db_path) {
	const years = readdirSync(db_path).map((y) => [
		y,
		parseDir(join(DB_PATH, y), 2)
	]);

	return { ...Object.fromEntries(years) };
}

const manifest = parseDB(DB_PATH);

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest));
// writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
