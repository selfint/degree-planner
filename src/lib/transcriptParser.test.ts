import { describe, it } from 'vitest';

import * as TranscriptParser from './transcriptParser';
import fs from 'fs';
import path from 'path';

describe('Transcript parser', () => {
	it('should parse English transcript', async (ctx) => {
		const filePath = path.resolve(
			__dirname,
			'./__snapshots__/transcript_en.pdf'
		);
		const file = fs.readFileSync(filePath);
		const buffer = new Uint8Array(file);

		const courses = await TranscriptParser.parseTranscript(buffer);

		ctx.expect(courses).toMatchInlineSnapshot(`
			{
			  "exemptions": [
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

		const courses = await TranscriptParser.parseTranscript(buffer);

		ctx.expect(courses).toMatchInlineSnapshot(`
			{
			  "exemptions": [
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
});
