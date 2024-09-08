/**
 * Tokenizes and normalizes a string by converting it to lowercase and splitting into words.
 * @param {string} text - The input text to tokenize.
 * @returns {string[]} - An array of normalized tokens.
 */
function tokenize(text: string): string[] {
	function removeHeHayedia(text: string): string {
		// Replace "ה" at the start of a word followed by a Hebrew letter, using a space or start of string as delimiter
		return text.replace(/(^|[\s])ה(?=[א-ת])/g, '$1');
	}

	function replaceEndingLetters(text: string): string {
		// Create a mapping of final letters to their normal forms
		const replacements = {
			ץ: 'צ',
			ף: 'פ',
			ן: 'נ',
			ם: 'מ',
			ך: 'כ'
		} as const;

		// Use replace with a callback function to swap ending letters with their normal forms
		return text.replace(
			/[ץףןםך]/g,
			(match) =>
				// @ts-expect-error
				replacements[match] || match
		);
	}

	text = replaceEndingLetters(text);
	text = removeHeHayedia(text);

	return text.toLowerCase().match(/\S+/g) || [];
}

/**
 * Calculates the term frequency (TF) of a term in a document.
 * @param {string} term - The term to calculate frequency for.
 * @param {string[]} document - The tokenized document as an array of words.
 * @returns {number} - The term frequency of the term in the document.
 */
function termFrequency(term: string, document: string[]): number {
	const termCount = document.filter((word) => word === term).length;
	return termCount / document.length;
}

/**
 * Calculates the inverse document frequency (IDF) of a term in a corpus.
 * @param {string} term - The term to calculate IDF for.
 * @param {string[][]} corpus - The corpus represented as an array of tokenized documents.
 * @returns {number} - The inverse document frequency of the term.
 */
function inverseDocumentFrequency(term: string, corpus: string[][]): number {
	const numDocumentsWithTerm = corpus.filter((doc) =>
		doc.includes(term)
	).length;
	if (numDocumentsWithTerm === 0) {
		return 0;
	}
	return Math.log(
		(corpus.length - numDocumentsWithTerm + 0.5) /
			(numDocumentsWithTerm + 0.5) +
			1
	);
}

// BM25 Parameters
const k1 = 1.5; // Term frequency saturation
const b = 0.75; // Length normalization

/**
 * Calculates the BM25 score for a document given a query.
 * @param {string[]} query - The tokenized query as an array of terms.
 * @param {string[]} document - The tokenized document to score.
 * @param {string[][]} corpus - The corpus of documents.
 * @param {number} avgDocLength - The average length of documents in the corpus.
 * @returns {number} - The BM25 score of the document for the given query.
 */
function bm25Score(
	query: string[],
	document: string[],
	corpus: string[][],
	avgDocLength: number
): number {
	let score = 0;
	query.forEach((term) => {
		const tf = termFrequency(term, document);
		const idf = inverseDocumentFrequency(term, corpus);
		const docLength = document.length;

		// BM25 formula
		score +=
			idf *
			((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength))));
	});
	return score;
}

/**
 * Ranks documents in the corpus based on BM25 scores for a given query.
 * @param {string} query - The input query string.
 * @param {string[]} corpus - The corpus of documents to rank.
 * @returns {{ index: number; score: number }[]} - An array of objects containing document indices and their BM25 scores, sorted by relevance.
 */
export function bm25(
	query: string,
	corpus: string[]
): { index: number; score: number }[] {
	// Tokenize query and corpus
	const tokenizedQuery = tokenize(query);
	const tokenizedCorpus = corpus.map((doc) => tokenize(doc));

	// Calculate average document length in the corpus
	const avgDocLength =
		tokenizedCorpus.reduce((sum, doc) => sum + doc.length, 0) /
		tokenizedCorpus.length;

	// Calculate BM25 scores for each document
	const scores = tokenizedCorpus.map((doc, index) => ({
		index,
		score: bm25Score(tokenizedQuery, doc, tokenizedCorpus, avgDocLength)
	}));

	// Sort documents by their scores in descending order
	return scores.sort((a, b) => b.score - a.score);
}
