import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mediaGroups } from '../src/lib/tutorialMedia.ts';

const root = new URL('../static/tutorials/', import.meta.url);
const manifest = JSON.parse(
	readFileSync(new URL('manifest.json', root), 'utf8')
);
const provenance = JSON.parse(
	readFileSync(new URL('../tutorials/provenance.json', import.meta.url), 'utf8')
);

describe('published tutorial media provenance', () => {
	it('retains the complete landing and in-app inventory with honest recording sources', () => {
		const expectedNames = Object.values(mediaGroups)
			.flat()
			.flatMap((topic) =>
				['en', 'he'].flatMap((language) =>
					['light', 'dark'].map((theme) => `${topic}-${language}-${theme}`)
				)
			);
		expect(manifest.map((entry) => entry.name).sort()).toEqual(
			expectedNames.sort()
		);
		if (provenance.schemaVersion !== 2) {
			// Existing homogeneous publications retain their original provenance.
			expect(provenance.schemaVersion).toBeUndefined();
			for (const entry of manifest)
				expect(entry.sourceCommit).toBe(provenance.sourceCommit);
			return;
		}
		// Scoped refreshes may mix recording commits, never pretend one run made all clips.
		expect(provenance.sourceCommit).toBeUndefined();
		expect(provenance.sources.length).toBeGreaterThan(0);
		const commits = provenance.sources.map((source) => source.sourceCommit);
		expect(new Set(commits).size).toBe(commits.length);
		for (const source of provenance.sources) {
			expect(source.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
			expect(source.run).toMatch(
				/^https:\/\/github\.com\/selfint\/degree-planner\/actions\/runs\/\d+$/
			);
			expect(Number.isSafeInteger(source.artifact)).toBe(true);
			expect(source.artifact).toBeGreaterThan(0);
			expect(source.artifactName).toContain(source.sourceCommit);
			expect(source.artifactZipSha256).toMatch(/^[a-f0-9]{64}$/);
		}
		for (const entry of manifest) {
			expect(commits).toContain(entry.sourceCommit);
			for (const extension of ['mp4', 'webm', 'webp', 'vtt']) {
				const file = provenance.files.find(
					(file) => file.file === `${entry.name}.${extension}`
				);
				expect(file?.sourceCommit).toBe(entry.sourceCommit);
			}
		}
		expect(new Set(manifest.map((entry) => entry.sourceCommit))).toEqual(
			new Set(commits)
		);
		// The manifest is an aggregate index, not a recording from either source.
		expect(
			provenance.files.find((file) => file.file === 'manifest.json')
				?.sourceCommit
		).toBeNull();
	});
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
						height: 720
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
		const entries = readdirSync(root, { withFileTypes: true });
		// Journey captures have their own strict inventory and source provenance.
		// Do not silently exclude any other directory or non-file entry.
		expect(
			entries
				.filter((entry) => !entry.isFile())
				.map((entry) => ({
					name: entry.name,
					directory: entry.isDirectory()
				}))
		).toEqual([{ name: 'journeys', directory: true }]);
		expect(provenance.files.map((file) => file.file).sort()).toEqual(
			entries
				.filter((entry) => entry.isFile())
				.map((entry) => entry.name)
				.sort()
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
