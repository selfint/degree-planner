export function parseCatalog(text: string): string[] {
	const regex = /\b\d{5,6}\b/g;
	const matches = text.match(regex);

	const codes = [...new Set(matches ? matches : [])];
	return codes
		.map((code) => code.replace(/^0+/, ''))
		.map((code) => '0'.repeat(6 - code.length) + code);
}
