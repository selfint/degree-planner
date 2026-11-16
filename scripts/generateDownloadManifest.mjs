import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Immutable snapshot URLs make decoded byte totals valid even with gzip/br.
const directory = join(process.cwd(), 'static', '_data');
rmSync(directory, { recursive: true, force: true });
mkdirSync(directory, { recursive: true });
const manifest = {};
for (const name of ['courseData.json', 'catalogs.json']) {
	const bytes = readFileSync(join(process.cwd(), 'static', name));
	const hash = createHash('sha256').update(bytes).digest('hex');
	const file = `${hash}.json`;
	writeFileSync(join(directory, file), bytes);
	manifest[`/${name}`] = { url: `/_data/${file}`, bytes: bytes.length };
}
writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest));
