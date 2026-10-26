import { describe, expect, it } from 'vitest';
import {
	computeBuildIdentity,
	isBuildInputPath,
	isOfflineShellStaticFile,
	readBuildIdentity
} from './buildIdentity.mjs';

const commit = 'a'.repeat(40);
const inputs = {
	commit,
	mode: 'production',
	nodeVersion: 'v24.1.0',
	platform: 'linux',
	arch: 'x64',
	files: [
		['src/lib/app.ts', 'export const app = 1;'],
		['src/lib/firebase.svelte.ts', 'const publicConfig = "project-a";'],
		['package-lock.json', '{"dependencies":{}}'],
		['static/icons/icon-192.png', Buffer.from([1, 2, 3])]
	]
};

describe('canonical installed app build identity', () => {
	it('is stable across repeated builds and filesystem traversal order', () => {
		const first = computeBuildIdentity(inputs);
		expect(first).toMatch(new RegExp(`^${commit}-[a-f0-9]{16}$`));
		expect(computeBuildIdentity(inputs)).toBe(first);
		expect(
			computeBuildIdentity({ ...inputs, files: [...inputs.files].reverse() })
		).toBe(first);
	});
	it.each([
		['src/lib/app.ts', 'export const app = 2;'],
		['src/lib/firebase.svelte.ts', 'const publicConfig = "project-b";'],
		['package-lock.json', '{"dependencies":{"updated":true}}'],
		['static/icons/icon-192.png', Buffer.from([4, 5, 6])]
	])(
		'changes for changed build input %s, even at the same commit',
		(path, contents) => {
			const changed = inputs.files.map(([name, value]) => [
				name,
				name === path ? contents : value
			]);
			expect(computeBuildIdentity({ ...inputs, files: changed })).not.toBe(
				computeBuildIdentity(inputs)
			);
		}
	);
	it.each([
		{ mode: 'development' },
		{ nodeVersion: 'v24.2.0' },
		{ platform: 'darwin' },
		{ arch: 'arm64' },
		{ commit: 'b'.repeat(40) }
	])('changes for changed provenance or build toolchain: %j', (change) => {
		expect(computeBuildIdentity({ ...inputs, ...change })).not.toBe(
			computeBuildIdentity(inputs)
		);
	});
	it('does not create phantom releases for independently fetched datasets or non-app files', () => {
		const extra = [
			['static/courseData.json', 'refreshed courses'],
			['static/_catalogs/2026/catalog.json', 'refreshed catalogs'],
			['static/tutorials/huge-video.mp4', 'video'],
			['src/lib/app.test.ts', 'test changes'],
			['src/stories/components/example.stories.ts', 'story changes']
		];
		expect(
			computeBuildIdentity({ ...inputs, files: [...inputs.files, ...extra] })
		).toBe(computeBuildIdentity(inputs));
	});
	it('uses unambiguous path and content framing', () => {
		expect(
			computeBuildIdentity({ ...inputs, files: [['src/a.ts', 'bc']] })
		).not.toBe(
			computeBuildIdentity({ ...inputs, files: [['src/ab.ts', 'c']] })
		);
	});
	it('does not fabricate Git provenance when no checkout identity exists', () => {
		expect(computeBuildIdentity({ ...inputs, commit: null })).toMatch(
			/^local-[a-f0-9]{16}$/
		);
		expect(() =>
			computeBuildIdentity({ ...inputs, commit: 'not-a-commit' })
		).toThrow('complete Git object ID');
	});
	it('fingerprints the identity contract and exactly the worker static selection', () => {
		expect(isBuildInputPath('scripts/buildIdentity.mjs')).toBe(true);
		for (const path of [
			'manifest.webmanifest',
			'favicon.webp',
			'brand/planit-logo.webp',
			'brand/planit-wordmark.svg',
			'icons/icon-192.png'
		]) {
			expect(isOfflineShellStaticFile(path)).toBe(true);
			expect(isBuildInputPath(`static/${path}`)).toBe(true);
		}
		expect(isOfflineShellStaticFile('courseData.json')).toBe(false);
	});
	it('reads the real checkout deterministically without consuming secrets or deployment IDs', () => {
		const first = readBuildIdentity(undefined, {
			VERCEL_GIT_COMMIT_SHA: commit,
			NODE_ENV: 'production'
		});
		const second = readBuildIdentity(undefined, {
			VERCEL_GIT_COMMIT_SHA: commit,
			NODE_ENV: 'production',
			VERCEL_DEPLOYMENT_ID: 'another-deployment',
			PRIVATE_SECRET: 'must-not-affect-build'
		});
		expect(second).toBe(first);
	});
});
