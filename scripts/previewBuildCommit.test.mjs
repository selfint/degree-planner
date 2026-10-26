import { describe, expect, it } from 'vitest';
import { previewBuildCommit } from './previewBuildCommit.mjs';

const sha = '8c16d4bb8a0de002a6ca14371b864764054334ca';
describe('served preview build identity', () => {
	it('reads the complete commit from actual HTML metadata', () => {
		expect(
			previewBuildCommit(
				`<head><meta name="planit-build" content="${sha}"></head>`
			)
		).toBe(sha);
	});
	it('supports self-closing server-rendered metadata', () => {
		expect(
			previewBuildCommit(`<meta name="planit-build" content="${sha}" />`)
		).toBe(sha);
	});
	it('does not treat an old deployment as the requested new commit', () => {
		const old = '0e34283cb8ac84d5a2f381c44e69e912ae6468de';
		expect(
			previewBuildCommit(`<meta name="planit-build" content="${old}">`)
		).not.toBe(sha);
	});
	it('does not infer an identity from an unmarked deployment', () => {
		expect(
			previewBuildCommit('<html><head><title>PlanIt</title></head></html>')
		).toBeNull();
	});
	it('rejects short hashes and unrelated metadata', () => {
		expect(
			previewBuildCommit('<meta name="planit-build" content="8c16d4bb">')
		).toBeNull();
		expect(
			previewBuildCommit(`<meta name="other-build" content="${sha}">`)
		).toBeNull();
	});
});
