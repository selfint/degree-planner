function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return hash;
}

export function generateColor(source: string): string {
	const hash = hashString(source.repeat(11));
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
