import courseData from '$lib/assets/courseData.json';

const courseMap = new Map<string, Course>(
	Object.entries(courseData) as [string, Course][]
);

export function getAllCourses(): Course[] {
	return Array.from(courseMap.values());
}

/**
 * Get course data for a course code
 * @param code Course code
 * @returns Course object, will return only the course code if the course is not found
 */
export function getCourseData(code: string): Course {
	return courseMap.get(code) || { code };
}
