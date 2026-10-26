import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { journeyTopics } from '../src/lib/journeyMedia.ts';
import { journeyRanges } from './journeyTimeline.mjs';
import { validateJourneyMetadata } from './journeyManifest.mjs';
const root = path.resolve('test-results/journeys-raw');
const output = path.resolve('test-results/journeys-media');
mkdirSync(output, { recursive: true });
const run = (command, args, options = {}) => {
	const r = spawnSync(command, args, {
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
		...options
	});
	if (r.status !== 0)
		throw new Error(`${command}: ${r.error?.message ?? r.stderr}`);
	return r.stdout;
};
const stamp = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23);
const manifest = [];
for (const topic of journeyTopics)
	for (const language of ['en', 'he'])
		for (const theme of ['light', 'dark']) {
			const name = `${topic}-${language}-${theme}`;
			const metadata = JSON.parse(
				readFileSync(path.join(root, `${name}.json`), 'utf8')
			);
			validateJourneyMetadata(metadata, topic, language, theme, {
				commit: process.env.GITHUB_SHA,
				run: process.env.GITHUB_RUN_ID
			});
			const pageRanges = new Map();
			for (const page of new Set(metadata.segments.map((s) => s.page))) {
				const source = path.join(root, `${name}-page-${page}.webm`);
				const probe = JSON.parse(
					run('ffprobe', [
						'-v',
						'error',
						'-show_streams',
						'-of',
						'json',
						source
					])
				);
				const stream = probe.streams.find((s) => s.codec_type === 'video');
				const [n, d] = stream.avg_frame_rate.split('/').map(Number);
				const pixels = run(
					'ffmpeg',
					[
						'-v',
						'error',
						'-i',
						source,
						'-vf',
						'crop=8:8:0:0,scale=1:1',
						'-pix_fmt',
						'rgb24',
						'-f',
						'rawvideo',
						'-'
					],
					{ encoding: null }
				);
				pageRanges.set(
					page,
					journeyRanges(
						pixels,
						n / d,
						metadata.segments.filter((s) => s.page === page).length
					)
				);
			}
			const segments = [];
			let elapsed = 0;
			let captions = 'WEBVTT\n\n';
			for (const [i, segment] of metadata.segments.entries()) {
				const range = pageRanges.get(segment.page)[segment.index];
				if (!range) throw new Error('Invalid named segment index');
				const file = path.join(output, `${name}-segment-${i}.mp4`);
				run('ffmpeg', [
					'-y',
					'-ss',
					String(range.start),
					'-i',
					path.join(root, `${name}-page-${segment.page}.webm`),
					'-t',
					String(range.duration),
					'-an',
					'-vf',
					'scale=960:720:force_original_aspect_ratio=decrease,pad=960:720:(ow-iw)/2:(oh-ih)/2',
					'-r',
					'25',
					'-c:v',
					'libx264',
					'-crf',
					'25',
					'-pix_fmt',
					'yuv420p',
					file
				]);
				segments.push(file);
				captions += `${i + 1}\n${stamp(elapsed)} --> ${stamp(elapsed + range.duration)}\n${segment.title}\n\n`;
				elapsed += range.duration;
			}
			const concat = path.join(output, `${name}-concat.txt`);
			writeFileSync(
				concat,
				segments.map((file) => `file '${file}'`).join('\n')
			);
			run('ffmpeg', [
				'-y',
				'-f',
				'concat',
				'-safe',
				'0',
				'-i',
				concat,
				'-c',
				'copy',
				'-movflags',
				'+faststart',
				path.join(output, `${name}.mp4`)
			]);
			run('ffmpeg', [
				'-y',
				'-i',
				path.join(output, `${name}.mp4`),
				'-an',
				'-c:v',
				'libvpx-vp9',
				'-b:v',
				'0',
				'-crf',
				'36',
				path.join(output, `${name}.webm`)
			]);
			run('ffmpeg', [
				'-y',
				'-i',
				path.join(output, `${name}.mp4`),
				'-frames:v',
				'1',
				path.join(output, `${name}.webp`)
			]);
			writeFileSync(path.join(output, `${name}.vtt`), captions);
			manifest.push({
				...metadata,
				source: `/tutorials/journeys/${name}`,
				duration: elapsed
			});
		}
writeFileSync(
	path.join(output, 'provenance.json'),
	JSON.stringify(manifest, null, 2)
);
// Only a complete, asserted 16-video matrix can be installed into Storybook.
if (process.argv.includes('--install')) {
	const destination = path.resolve('static/tutorials/journeys');
	mkdirSync(destination, { recursive: true });
	for (const m of manifest)
		for (const ext of ['mp4', 'webm', 'webp', 'vtt'])
			copyFileSync(
				path.join(output, `${m.topic}-${m.language}-${m.theme}.${ext}`),
				path.join(destination, `${m.topic}-${m.language}-${m.theme}.${ext}`)
			);
	copyFileSync(
		path.join(output, 'provenance.json'),
		path.join(destination, 'provenance.json')
	);
	writeFileSync(
		'src/lib/journeyRecordings.json',
		JSON.stringify(manifest, null, 2)
	);
}
