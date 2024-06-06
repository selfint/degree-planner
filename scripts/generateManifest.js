import { readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.cwd(), 'static', '_db');
const manifestPath = join(process.cwd(), 'src', 'lib', 'assets', 'manifest.json');

function readDirectoryRecursively(directory) {
	const result = {};
	const files = readdirSync(directory);

	files.forEach((file) => {
		const filePath = join(directory, file);
		const stats = statSync(filePath);

		if (stats.isDirectory()) {
			result[file] = readDirectoryRecursively(filePath);
		} else {
			result[file] = null;
		}
	});

	return result;
}

const manifest = readDirectoryRecursively(dbPath);

writeFileSync(manifestPath, JSON.stringify(manifest));
