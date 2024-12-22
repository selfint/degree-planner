import { readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.cwd(), 'static', '_catalogs');
const manifestPath = join(
	process.cwd(),
	'src',
	'lib',
	'assets',
	'catalogsHeader.json'
);

function nestRequirements(name, requirements) {
	const keywords = [
		'courses',
		'count',
		'amount',
		'points',
		'he',
		'en',
		'overflow',
		'hook'
	];

	const nonKeywords = Object.keys(requirements).filter(
		(key) => !keywords.includes(key)
	);

	const nested = [];
	for (const key of nonKeywords) {
		nested.push({
			name: key,
			en: requirements[key].en,
			he: requirements[key].he
		});
	}

	return {
		name,
		he: requirements.he,
		en: requirements.en,
		nested: nested.length > 0 ? nested : undefined
	};
}

function readDirectoryRecursively(directory, parents = []) {
	const result = {};
	const files = readdirSync(directory);

	files.forEach((file) => {
		const filePath = join(directory, file);
		const stats = statSync(filePath);

		if (stats.isDirectory()) {
			result[file] = readDirectoryRecursively(filePath, [...parents, file]);

			if (file === 'requirement') {
				const name = parents.slice(-2).join('/');
				result[file] = nestRequirements(name, result[file]);
			}
		} else {
			const content = readFileSync(filePath, 'utf8');

			if (file.startsWith('semester')) {
			} else if (file === 'courses') {
			} else if (file === 'hook.js') {
			} else if (['count', 'amount', 'points'].includes(file)) {
			} else {
				result[file] = content;
			}
		}
	});

	return result;
}

const manifest = readDirectoryRecursively(dbPath);

writeFileSync(manifestPath, JSON.stringify(manifest));
