import assert from 'node:assert/strict';
import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mediaGroups, mediaVariants } from '../src/lib/tutorialMedia.ts';

export function validateShard(directory, topic, sourceCommit) {
	assert.match(
		sourceCommit,
		/^[a-f0-9]{40}$/,
		'an exact source commit is required'
	);
	assert.ok(
		mediaGroups.features.includes(topic),
		'only landing topics may be merged'
	);
	const manifest = JSON.parse(
		readFileSync(path.join(directory, 'manifest.json'), 'utf8')
	);
	const expected = mediaVariants(topic)
		.map(({ name }) => name)
		.sort();
	assert.deepEqual(
		manifest.map(({ name }) => name).sort(),
		expected,
		'exact four-variant shard inventory'
	);
	const files = expected.flatMap((name) =>
		['mp4', 'webm', 'webp', 'vtt'].map((ext) => `${name}.${ext}`)
	);
	assert.deepEqual(
		readdirSync(directory).sort(),
		[...files, 'manifest.json'].sort(),
		'no missing or unexpected shard files'
	);
	for (const entry of manifest) {
		assert.equal(
			entry.sourceCommit,
			sourceCommit,
			'shards must come from the current source'
		);
		assert.equal(entry.width, 960);
		assert.equal(entry.height, 720);
		assert.ok(Number.isFinite(entry.duration) && entry.duration > 0);
	}
	for (const file of files) {
		const contents = readFileSync(path.join(directory, file));
		assert.ok(contents.length > 0, `empty asset: ${file}`);
		if (file.endsWith('.vtt')) assert.match(contents.toString(), /^WEBVTT\n/);
	}
	return { manifest, files };
}

export function mergeLandingShards(input, output, sourceCommit) {
	assert.deepEqual(
		readdirSync(input).sort(),
		[...mediaGroups.features].sort(),
		'exact seven landing shards'
	);
	// Validate every shard before copying anything. Never consult checked-in media.
	const shards = mediaGroups.features.map((topic) => ({
		directory: path.join(input, topic),
		...validateShard(path.join(input, topic), topic, sourceCommit)
	}));
	mkdirSync(output, { recursive: true });
	assert.equal(readdirSync(output).length, 0, 'aggregate output must be empty');
	for (const { directory, files } of shards)
		for (const file of files)
			copyFileSync(path.join(directory, file), path.join(output, file));
	const manifest = shards
		.flatMap((shard) => shard.manifest)
		.sort((a, b) => a.name.localeCompare(b.name));
	writeFileSync(
		path.join(output, 'manifest.json'),
		JSON.stringify(manifest, null, 2)
	);
	console.log(
		`Validated and merged ${manifest.length} landing variants from ${sourceCommit}`
	);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
	mergeLandingShards(
		'test-results/tutorials-shards',
		'test-results/tutorials-media',
		process.env.GITHUB_SHA ?? ''
	);
