import { expect, it } from 'vitest';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isOfflineShellStaticFile } from './buildIdentity.mjs';
it('publishes exact UTF-8 byte totals and content-addressed copies outside the offline shell', () => {
	const root = mkdtempSync(join(tmpdir(), 'planit-download-'));
	try {
		mkdirSync(join(root, 'static'));
		const content = Buffer.from('{"name":"קורס"}');
		for (const name of ['courseData.json', 'catalogs.json'])
			writeFileSync(join(root, 'static', name), content);
		execFileSync(
			process.execPath,
			[resolve('scripts/generateDownloadManifest.mjs')],
			{ cwd: root }
		);
		const manifest = JSON.parse(
			readFileSync(join(root, 'static/_data/manifest.json'), 'utf8')
		);
		const entry = manifest['/courseData.json'];
		expect(entry).toEqual({
			url: `/_data/${createHash('sha256').update(content).digest('hex')}.json`,
			bytes: content.length
		});
		expect(readFileSync(join(root, 'static', entry.url))).toEqual(content);
		expect(isOfflineShellStaticFile(entry.url.slice(1))).toBe(false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
