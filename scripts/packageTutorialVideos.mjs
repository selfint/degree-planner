import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { recordingStart } from './tutorialTimeline.mjs';

const input = path.resolve('test-results/tutorials-raw');
const output = path.resolve('test-results/tutorials-media');
mkdirSync(output, { recursive: true });
function run(command, args) {
	const result = spawnSync(command, args, { encoding: 'utf8' });
	if (result.status !== 0)
		throw new Error(
			`${command} failed: ${result.error?.message ?? result.stderr}`
		);
	return result.stdout;
}
function timestamp(seconds) {
	return new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23);
}
const manifest = [];
for (const topic of ['course-card', 'plan-course']) {
	for (const language of ['en', 'he']) {
		for (const theme of ['light', 'dark']) {
			const name = `${topic}-${language}-${theme}`;
			const source = path.join(input, `${name}.webm`);
			// Missing/failed recordings fail closed, never publish a partial asset set.
			const metadata = JSON.parse(
				readFileSync(path.join(input, `${name}.json`), 'utf8')
			);
			const probe = JSON.parse(
				run('ffprobe', [
					'-v',
					'error',
					'-show_format',
					'-show_streams',
					'-of',
					'json',
					source
				])
			);
			if (metadata.timeline !== 'magenta-slate-v1')
				throw new Error(`Recording ${name} has no verified frame timeline`);
			const [numerator, denominator] = probe.streams[0].avg_frame_rate
				.split('/')
				.map(Number);
			const pixels = spawnSync(
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
				{ maxBuffer: 8 * 1024 * 1024 }
			);
			if (pixels.status !== 0)
				throw new Error(`Cannot decode recording timeline: ${pixels.stderr}`);
			const offset = recordingStart(pixels.stdout, numerator / denominator);
			run('ffmpeg', [
				'-y',
				'-ss',
				String(offset),
				'-i',
				source,
				'-t',
				String(metadata.duration),
				'-an',
				'-c:v',
				'libx264',
				'-preset',
				'medium',
				'-crf',
				'25',
				'-pix_fmt',
				'yuv420p',
				'-movflags',
				'+faststart',
				path.join(output, `${name}.mp4`)
			]);
			run('ffmpeg', [
				'-y',
				'-ss',
				String(offset),
				'-i',
				source,
				'-t',
				String(metadata.duration),
				'-an',
				'-c:v',
				'libvpx-vp9',
				'-b:v',
				'0',
				'-crf',
				'34',
				'-row-mt',
				'1',
				path.join(output, `${name}.webm`)
			]);
			run('ffmpeg', [
				'-y',
				'-i',
				path.join(input, `${name}-poster.png`),
				'-frames:v',
				'1',
				'-quality',
				'85',
				path.join(output, `${name}.webp`)
			]);
			const captions = metadata.captions
				.map(
					(caption, i) =>
						`${i + 1}\n${timestamp(caption.start)} --> ${timestamp(caption.end)}\n${caption.text}\n`
				)
				.join('\n');
			writeFileSync(path.join(output, `${name}.vtt`), `WEBVTT\n\n${captions}`);
			manifest.push({
				name,
				duration: metadata.duration,
				width: 960,
				height: 720,
				sourceCommit: process.env.GITHUB_SHA ?? null
			});
		}
	}
}
writeFileSync(
	path.join(output, 'manifest.json'),
	JSON.stringify(manifest, null, 2)
);
console.log(`Packaged ${manifest.length} asserted tutorials in ${output}`);
