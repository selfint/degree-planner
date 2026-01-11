import { describe, it } from 'vitest';

import * as TranscriptParser from './transcriptParser';
import fs from 'fs';
import path from 'path';

const url = '../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

const COURSE_DATA = JSON.parse(
	fs
		.readFileSync(path.join(process.cwd(), 'static', 'courseData.json'))
		.toString()
);

async function localGetCourseData(code: string): Promise<Course> {
	return COURSE_DATA[code] || { code };
}

describe('Transcript parser', () => {
	it('should parse English transcript', async (ctx) => {
		const filePath = path.resolve(
			__dirname,
			'./__snapshots__/transcript_en.pdf'
		);
		const file = fs.readFileSync(filePath);
		const buffer = new Uint8Array(file);

		const courses = await TranscriptParser.parseTranscript(
			localGetCourseData,
			buffer,
			url
		);

		ctx.expect(courses).toMatchInlineSnapshot(`
			{
			  "exemptions": [
			    "01030015",
			    "01040031",
			    "01040032",
			    "01040166",
			    "01140071",
			    "01230015",
			    "02340114",
			    "02340129",
			    "02340141",
			    "03240033",
			    "03240053",
			  ],
			  "semesters": [
			    [
			      "01040174",
			      "02340124",
			      "02340125",
			    ],
			    [
			      "00440252",
			      "00940412",
			      "02340218",
			      "02340292",
			      "02360781",
			    ],
			    [],
			    [
			      "02340118",
			      "02340247",
			      "02360754",
			      "02360766",
			      "03260006",
			    ],
			  ],
			}
		`);
	});
	it('should parse Hebrew transcript', async (ctx) => {
		const filePath = path.resolve(
			__dirname,
			'./__snapshots__/transcript_he.pdf'
		);
		const file = fs.readFileSync(filePath);
		const buffer = new Uint8Array(file);

		const courses = await TranscriptParser.parseTranscript(
			localGetCourseData,
			buffer,
			url
		);

		ctx.expect(courses).toMatchInlineSnapshot(`
			{
			  "exemptions": [
			    "01030015",
			    "01040031",
			    "01040032",
			    "01040166",
			    "01140071",
			    "01230015",
			    "02340114",
			    "02340129",
			    "02340141",
			    "03240033",
			    "03240053",
			  ],
			  "semesters": [
			    [
			      "01040174",
			      "02340124",
			      "02340125",
			    ],
			    [
			      "00440252",
			      "00940412",
			      "02340218",
			      "02340292",
			      "02360781",
			    ],
			    [],
			    [
			      "02340118",
			      "02340247",
			      "02360754",
			      "02360766",
			      "03260006",
			    ],
			  ],
			}
		`);
	});

	it('should parse legacy transcript en', async (ctx) => {
		const filePath = path.resolve(
			__dirname,
			'./__snapshots__/legacy-transcript-en.pdf'
		);
		const file = fs.readFileSync(filePath);
		const buffer = new Uint8Array(file);

		const courses = await TranscriptParser.parseTranscript(
			localGetCourseData,
			buffer,
			url
		);
		ctx.expect(courses).toMatchInlineSnapshot(`
			{
			  "exemptions": [
			    "01030015",
			    "01040031",
			    "01040032",
			    "01040166",
			    "01140071",
			    "01230015",
			    "02340114",
			    "02340129",
			    "02340141",
			    "03240033",
			  ],
			  "semesters": [
			    [
			      "01040174",
			      "02340124",
			      "02340125",
			    ],
			    [
			      "00440252",
			      "00940412",
			      "02340218",
			      "02340292",
			      "02360781",
			    ],
			  ],
			}
		`);
	});

	it('should parse legacy transcript he', async (ctx) => {
		const filePath = path.resolve(
			__dirname,
			'./__snapshots__/legacy-transcript-he.pdf'
		);
		const file = fs.readFileSync(filePath);
		const buffer = new Uint8Array(file);

		const courses = await TranscriptParser.parseTranscript(
			localGetCourseData,
			buffer,
			url
		);
		ctx.expect(courses).toMatchInlineSnapshot(`
			{
			  "exemptions": [
			    "01030015",
			    "01040031",
			    "01040032",
			    "01040166",
			    "01140071",
			    "01230015",
			    "02340114",
			    "02340129",
			    "02340141",
			    "03240033",
			  ],
			  "semesters": [
			    [
			      "01040174",
			      "02340124",
			      "02340125",
			    ],
			    [
			      "00440252",
			      "00940412",
			      "02340218",
			      "02340292",
			      "02360781",
			    ],
			  ],
			}
		`);
	});
});
