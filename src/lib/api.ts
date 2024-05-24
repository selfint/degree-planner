export async function getName(course: string): Promise<string | undefined> {
	const response = await fetch('/api/courseInfo' + '?c=' + course);

	if (response.ok) {
		return await response.json();
	} else {
		return undefined;
	}
}
