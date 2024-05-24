export async function getCourseInfo(course: string): Promise<CourseInfo | undefined> {
	const response = await fetch('/api/courseInfo' + '?c=' + course);

	if (response.ok) {
		return await response.json();
	} else {
		return undefined;
	}
}
