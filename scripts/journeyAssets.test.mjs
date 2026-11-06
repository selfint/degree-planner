import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	journeyTopics,
	journeyTitles,
	journeyDescriptions
} from '../src/lib/journeyMedia.ts';
import { validateJourneyMetadata } from './journeyManifest.mjs';
const root = new URL('../static/tutorials/journeys/', import.meta.url);
const read = (url) => JSON.parse(readFileSync(url, 'utf8'));
const recordings = read(
	new URL('../src/lib/journeyRecordings.json', import.meta.url)
);
const source = read(
	new URL('../tutorials/journeys-provenance.json', import.meta.url)
);
describe('published independent student-journey media', () => {
	it('includes all 16 real variants with exact capture provenance and named segments', () => {
		expect(recordings).toHaveLength(16);
		expect(recordings).toEqual(read(new URL('provenance.json', root)));
		for (const topic of journeyTopics)
			for (const language of ['en', 'he'])
				for (const theme of ['light', 'dark']) {
					const matches = recordings.filter(
						(r) =>
							r.topic === topic && r.language === language && r.theme === theme
					);
					expect(matches).toHaveLength(1);
					const r = matches[0];
					validateJourneyMetadata(r, topic, language, theme, {
						commit: source.sourceCommit,
						run: source.run
					});
					expect(r.source).toBe(
						`/tutorials/journeys/${topic}-${language}-${theme}`
					);
					expect(r.duration).toBeGreaterThan(1);
					for (const ext of ['mp4', 'webm', 'webp', 'vtt'])
						expect(
							readFileSync(
								new URL(`${topic}-${language}-${theme}.${ext}`, root)
							).length
						).toBeGreaterThan(0);
					const vtt = readFileSync(
						new URL(`${topic}-${language}-${theme}.vtt`, root),
						'utf8'
					);
					expect(vtt).toMatch(/^WEBVTT\n/);
					for (const segment of r.segments) {
						expect(vtt).toContain(segment.title);
						if (language === 'he') expect(segment.title).toMatch(/[א-ת]/);
					}
				}
	});
	it('matches the independent exact file inventory, SHA256 hashes and byte sizes', () => {
		expect(source.files.map((f) => f.file).sort()).toEqual(
			readdirSync(root).sort()
		);
		let bytes = 0;
		for (const f of source.files) {
			expect(f.file).not.toContain('/');
			const data = readFileSync(new URL(f.file, root));
			expect(data.length).toBe(f.bytes);
			expect(createHash('sha256').update(data).digest('hex')).toBe(f.sha256);
			bytes += data.length;
		}
		expect(bytes).toBe(source.totalBytes);
		expect(source.runUrl).toBe(
			`https://github.com/selfint/degree-planner/actions/runs/${source.run}`
		);
	});
	it('has localized titles, captions and descriptions rather than placeholder media', () => {
		for (const topic of journeyTopics) {
			expect(journeyTitles[topic].he).toMatch(/[א-ת]/);
			expect(journeyDescriptions[topic].he).toMatch(/[א-ת]/);
			expect(journeyTitles[topic].en.length).toBeGreaterThan(10);
			expect(journeyDescriptions[topic].en.length).toBeGreaterThan(30);
		}
		const component = readFileSync(
			new URL('../src/routes/components/UserFlowVideo.svelte', import.meta.url),
			'utf8'
		);
		expect(component).toContain('{#key recording.source}');
		expect(component).not.toContain('Verified recordings appear');
	});
});
