/** Stable Svelte keys for lists that may contain repeated domain identifiers. */
export function keyedItems<T>(
	items: readonly T[],
	identify: (item: T) => string | number
): { key: string; value: T }[] {
	const occurrences = new Map<string | number, number>();
	return items.map((value) => {
		const identity = identify(value);
		const occurrence = occurrences.get(identity) ?? 0;
		occurrences.set(identity, occurrence + 1);
		// JSON encoding keeps delimiters inside an identifier from causing collisions.
		return { key: JSON.stringify([identity, occurrence]), value };
	});
}
