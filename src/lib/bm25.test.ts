import { describe, it, expect } from 'vitest';

import { bm25 } from './bm25';

describe('BM 25', () => {
	it('searches strings', () => {
		const corpus = [
			'First string about a color',
			'Second string about a house',
			'Third string about a red house'
		];

		const query = 'red house';

		const results = bm25(query, corpus);

		// add the corpus hit to each result
		const snap = results.map((result) => {
			return {
				index: result.index,
				// get first two digits after the decimal point
				score: Math.round(result.score * 100),
				string: corpus[result.index]
			};
		});

		expect(snap).toMatchInlineSnapshot(`
			[
			  {
			    "index": 2,
			    "score": 33,
			    "string": "Third string about a red house",
			  },
			  {
			    "index": 1,
			    "score": 14,
			    "string": "Second string about a house",
			  },
			  {
			    "index": 0,
			    "score": 0,
			    "string": "First string about a color",
			  },
			]
		`);
	});

	it('searches hebrew strings', () => {
		const corpus = [
			'כלב רץ אחרי החתול',
			'החתול רץ אחרי העכבר',
			'הכלב רץ אחרי הכדור'
		];

		const query = 'כלב רץ עם כדור';

		const results = bm25(query, corpus);

		// add the corpus hit to each result
		const snap = results.map((result) => {
			return {
				index: result.index,
				// get first two digits after the decimal point
				score: Math.round(result.score * 100),
				string: corpus[result.index]
			};
		});

		expect(snap).toMatchInlineSnapshot(`
			[
			  {
			    "index": 2,
			    "score": 57,
			    "string": "הכלב רץ אחרי הכדור",
			  },
			  {
			    "index": 0,
			    "score": 22,
			    "string": "כלב רץ אחרי החתול",
			  },
			  {
			    "index": 1,
			    "score": 5,
			    "string": "החתול רץ אחרי העכבר",
			  },
			]
		`);
	});
});
