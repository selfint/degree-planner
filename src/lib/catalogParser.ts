export function parseCatalog(text: string): string[] {
	const regex = /\b\d{6}\b/g;
	const matches = text.match(regex);

	return [...new Set(matches ? matches : [])];
}
