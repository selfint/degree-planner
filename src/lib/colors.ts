/**
 * https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 */
function cyrb53(str: string, seed = 0) {
	let h1 = 0xdeadbeef ^ seed,
		h2 = 0x41c6ce57 ^ seed;
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function generateColor(source: string): string {
	const hash = cyrb53(source);
	const hue = hash % 360;
	const saturation = 50;
	const lightness = 30;

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function generateCourseColor(course: Course): string {
	return generateColor(course.code + (course.name ?? ''));
}

export function generateRequirementColor(requirement: string): string {
	return generateColor(requirement);
}
