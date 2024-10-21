import { readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.cwd(), 'static', '_catalogs');
const manifestPath = join(
	process.cwd(),
	'src',
	'lib',
	'assets',
	'catalogs.json'
);

function formatName(name) {
	return name
		.replace(/_/g, ' ')
		.split(' ')
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');
}

function parseCatalog(text) {
	const regex = /\b\d{5,6}\b/g;
	const matches = text.match(regex);

	const codes = [...new Set(matches ? matches : [])];
	return codes
		.map((code) => code.replace(/^0+/, ''))
		.map((code) => '0'.repeat(6 - code.length) + code)
		.map((code) => '0' + code.slice(0, 3) + '0' + code.slice(3));
}

function nestRequirements(name, requirements) {
	const keywords = [
		'courses',
		'count',
		'amount',
		'points',
		'he',
		'overflow',
		'hook'
	];
	const translations = new Map([
		['core', 'חובה'],
		['sport', 'ספורט'],
		['english', 'אנגלית'],
		['list_a', 'רשימה א׳'],
		['list_b', 'רשימה ב׳']
	]);

	const nonKeywords = Object.keys(requirements).filter(
		(key) => !keywords.includes(key)
	);

	const nested = [];
	for (const key of nonKeywords) {
		nested.push(nestRequirements(key, requirements[key]));
	}

	return {
		name: name,
		courses: requirements.courses,
		count: requirements.count,
		amount: requirements.amount,
		points: requirements.points,
		he: requirements.he ?? translations.get(name),
		overflow: requirements.overflow,
		nested: nested.length > 0 ? nested : undefined,
		hook: requirements.hook
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
				const name = formatName(parents.slice(-2).join(' - '));
				result[file] = nestRequirements(name, result[file]);
			} else if (file === 'shared') {
				result[file] = nestRequirements(file, result[file]);
			} else if (file === 'recommended') {
				const semesters = readDirectoryRecursively(filePath, [
					...parents,
					file
				]);

				result[file] = Object.entries(semesters)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([, courses]) => courses);
			}
		} else {
			const content = readFileSync(filePath, 'utf8');

			if (file.startsWith('semester')) {
				result[file] = parseCatalog(content);
			} else if (file === 'courses') {
				result[file] = `/_catalogs/${[...parents, file].join('/')}`;
			} else if (file === 'hook.js') {
				result['hook'] = `/_catalogs/${[...parents, file].join('/')}`;
			} else if (['count', 'amount', 'points'].includes(file)) {
				result[file] = parseFloat(content);
			} else {
				result[file] = content;
			}
		}
	});

	return result;
}

const manifest = readDirectoryRecursively(dbPath);

// writeFileSync(manifestPath, JSON.stringify(manifest));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
