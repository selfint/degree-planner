import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { isImmutableAppAsset } from '../src/lib/pwa/cache-policy';

it('retains every immutable asset naming convention emitted by the actual production build', () => {
	const files = readdirSync(
		resolve('.svelte-kit/output/client/_app/immutable'),
		{ recursive: true, withFileTypes: true }
	)
		.filter((entry) => entry.isFile())
		.map(
			(entry) =>
				`${entry.parentPath}/${entry.name}`.split('/_app/immutable/')[1]
		);
	expect(files.length).toBeGreaterThan(0);
	expect(files.some((path) => /^chunks\/[^.]+\.js$/.test(path))).toBe(true);
	for (const path of files)
		expect(isImmutableAppAsset(`/_app/immutable/${path}`), path).toBe(true);
});
