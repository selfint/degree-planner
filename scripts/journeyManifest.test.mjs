import { expect, it } from 'vitest';
import { validateJourneyMetadata } from './journeyManifest.mjs';
const metadata = () => ({
	schema: 1,
	status: 'passed',
	topic: 'independent-share',
	language: 'en',
	theme: 'dark',
	commit: 'a'.repeat(40),
	run: '123',
	testFile: 'tests/student-journeys.test.ts',
	segments: [
		{ name: 'owner-share', page: 0, index: 0, title: 'Owner' },
		{ name: 'share-preview', page: 1, index: 0, title: 'Preview' },
		{ name: 'recipient-import', page: 2, index: 0, title: 'Recipient' },
		{ name: 'owner-unchanged', page: 0, index: 1, title: 'Owner unchanged' }
	]
});
const validate = (m) =>
	validateJourneyMetadata(m, 'independent-share', 'en', 'dark', {
		commit: 'a'.repeat(40),
		run: '123'
	});
it('requires owner, popup, independent recipient and unchanged owner in order', () =>
	expect(() => validate(metadata())).not.toThrow());
it('rejects missing secondary-context segments', () => {
	const m = metadata();
	m.segments.splice(2, 1);
	expect(() => validate(m)).toThrow('Incomplete');
});
it('rejects failed or unattributed runs', () => {
	expect(() => validate({ ...metadata(), status: 'failed' })).toThrow();
	expect(() => validate({ ...metadata(), commit: null })).toThrow();
});
it('rejects incorrect page segment indexes', () => {
	const m = metadata();
	m.segments[3].index = 0;
	expect(() => validate(m)).toThrow('Invalid');
});

it('rejects valid but stale captures from a different commit or run', () => {
	expect(() => validate({ ...metadata(), commit: 'b'.repeat(40) })).toThrow(
		'Stale'
	);
	expect(() => validate({ ...metadata(), run: '122' })).toThrow('Stale');
});
