import { test, onTestFinished } from 'vitest';
import assert from 'node:assert/strict';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mediaGroups, mediaVariants } from '../src/lib/tutorialMedia.ts';
import {
	mergeLandingShards,
	validateShard
} from './mergeLandingTutorialShards.mjs';

const sha = 'a'.repeat(40);
function fixture() {
	const root = mkdtempSync(path.join(tmpdir(), 'landing-shards-'));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const input = path.join(root, 'input');
	for (const topic of mediaGroups.features) {
		const directory = path.join(input, topic);
		mkdirSync(directory, { recursive: true });
		const manifest = mediaVariants(topic).map(({ name }) => ({
			name,
			duration: 10,
			width: 960,
			height: 720,
			sourceCommit: sha
		}));
		writeFileSync(
			path.join(directory, 'manifest.json'),
			JSON.stringify(manifest)
		);
		for (const { name } of manifest)
			for (const ext of ['mp4', 'webm', 'webp', 'vtt'])
				writeFileSync(
					path.join(directory, `${name}.${ext}`),
					ext === 'vtt' ? 'WEBVTT\n' : 'fixture'
				);
	}
	return {
		input,
		output: path.join(root, 'output'),
		directory: path.join(input, 'feature-plan')
	};
}

test('merges only the exact 28 current-source landing variants', () => {
	const { input, output } = fixture();
	mergeLandingShards(input, output, sha);
	const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json')));
	assert.equal(manifest.length, 28);
	assert.ok(
		manifest.every(
			(entry) => entry.name.startsWith('feature-') && entry.sourceCommit === sha
		)
	);
});
for (const problem of [
	'missing shard',
	'unexpected shard',
	'missing file',
	'unexpected file',
	'empty file',
	'duplicate variant',
	'wrong source',
	'wrong dimensions',
	'invalid duration'
]) {
	test(`rejects ${problem}`, () => {
		const { input, output, directory } = fixture();
		const file = path.join(directory, 'manifest.json');
		const manifest = JSON.parse(readFileSync(file));
		if (problem === 'missing shard') rmSync(directory, { recursive: true });
		if (problem === 'unexpected shard')
			mkdirSync(path.join(input, 'course-card'));
		if (problem === 'missing file')
			rmSync(path.join(directory, `${manifest[0].name}.mp4`));
		if (problem === 'unexpected file')
			writeFileSync(path.join(directory, 'stale.mp4'), 'old');
		if (problem === 'empty file')
			writeFileSync(path.join(directory, `${manifest[0].name}.mp4`), '');
		if (problem === 'duplicate variant') manifest[1] = manifest[0];
		if (problem === 'wrong source') manifest[0].sourceCommit = 'b'.repeat(40);
		if (problem === 'wrong dimensions') manifest[0].width = 1;
		if (problem === 'invalid duration') manifest[0].duration = 0;
		if (problem !== 'missing shard')
			writeFileSync(file, JSON.stringify(manifest));
		assert.throws(() => mergeLandingShards(input, output, sha));
	});
}
test('rejects an absent source commit and an in-app topic', () => {
	const { directory } = fixture();
	assert.throws(() => validateShard(directory, 'feature-plan', ''));
	assert.throws(() => validateShard(directory, 'course-card', sha));
});
