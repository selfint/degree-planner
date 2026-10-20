import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const root = new URL('../static/tutorials/', import.meta.url);
const manifest = JSON.parse(
	readFileSync(new URL('manifest.json', root), 'utf8')
);
const provenance = JSON.parse(
	readFileSync(new URL('../tutorials/provenance.json', import.meta.url), 'utf8')
);

describe('published tutorial media provenance', () => {
	it('contains complete four-variant sets and all playable formats/posters/captions', () => {
		const topics = new Set(
			manifest.map((entry) => entry.name.replace(/-(en|he)-(light|dark)$/, ''))
		);
		for (const topic of topics) {
			for (const language of ['en', 'he'])
				for (const theme of ['light', 'dark']) {
					const name = `${topic}-${language}-${theme}`;
					const entries = manifest.filter((entry) => entry.name === name);
					expect(entries).toHaveLength(1);
					expect(entries[0]).toMatchObject({
						width: 960,
						height: 720,
						sourceCommit: provenance.sourceCommit
					});
					for (const extension of ['mp4', 'webm', 'webp', 'vtt']) {
						const contents = readFileSync(
							new URL(`${name}.${extension}`, root)
						);
						expect(contents.length).toBeGreaterThan(0);
						if (extension === 'vtt')
							expect(contents.toString()).toMatch(/^WEBVTT\n/);
					}
				}
		}
	});
	it('matches the exact recorded file inventory, hashes and byte sizes', () => {
		expect(provenance.files.map((file) => file.file).sort()).toEqual(
			readdirSync(root).sort()
		);
		let total = 0;
		for (const file of provenance.files) {
			const contents = readFileSync(new URL(file.file, root));
			expect(contents.length).toBe(file.bytes);
			expect(createHash('sha256').update(contents).digest('hex')).toBe(
				file.sha256
			);
			total += contents.length;
		}
		expect(total).toBe(provenance.totalBytes);
	});
});
