import { describe, expect, it, vi } from 'vitest';

// Use PDF.js's real Node-compatible build, not a text-extraction mock.
vi.mock('pdfjs-dist', () => import('pdfjs-dist/legacy/build/pdf.mjs'));
import { resolve } from 'node:path';
import { transcriptPdf } from '../../tests/helpers/transcript-pdf';
import { parseTranscript } from './transcriptParser';
import { getTranscriptImportErrorKind } from './transcriptImportError';

const worker = resolve(
	'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'
);
const getCourseData = async (code: CourseCode) =>
	({
		code,
		...(code === '02340124' ? { name: 'Fictional course fixture' } : {})
	}) as Course;

describe('real PDF transcript validation', () => {
	for (const lines of [
		[],
		['Student information only. No courses.'],
		['Exemptions', '02340124']
	]) {
		it(`rejects a valid PDF without recognized semesters: ${JSON.stringify(lines)}`, async () => {
			await expect(
				parseTranscript(getCourseData, transcriptPdf(lines), worker)
			).resolves.toBeUndefined();
		});
	}
	it('keeps a recognized text transcript importable', async () => {
		await expect(
			parseTranscript(
				getCourseData,
				transcriptPdf(['Winter 2025-2026', '02340124']),
				worker
			)
		).resolves.toEqual({ semesters: [['02340124']], exemptions: [] });
	});
	it('identifies an actual malformed-PDF failure', async () => {
		const error = await parseTranscript(
			getCourseData,
			new TextEncoder().encode('Not a PDF'),
			worker
		).catch((error: unknown) => error);
		expect(getTranscriptImportErrorKind(error)).toBe('invalid');
	});
	it('preserves a course-data failure rather than turning it into an invalid PDF', async () => {
		const error = new TypeError('Fictional course-data request failed');
		await expect(
			parseTranscript(
				async () => {
					throw error;
				},
				transcriptPdf(['Winter 2025-2026', '02340124']),
				worker
			)
		).rejects.toBe(error);
		expect(getTranscriptImportErrorKind(error)).toBe('failed');
	});
});

describe('transcript failure messages', () => {
	it('identifies a PDF.js password exception', () => {
		expect(getTranscriptImportErrorKind({ name: 'PasswordException' })).toBe(
			'password'
		);
	});
	it.each([
		new Error('Unexpected failure'),
		undefined,
		null,
		'unknown failure'
	])('does not label unexpected errors as invalid PDFs: %s', (error) => {
		expect(getTranscriptImportErrorKind(error)).toBe('failed');
	});
});
