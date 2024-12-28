import courseData from '$lib/assets/courseData.json';

export function getAllCourses(): Course[] {
	return Object.values(courseData) as Course[];
}

/**
 * Get course data for a course code
 * @param code Course code
 * @returns Course object, will return only the course code if the course is not found
 */
export function getCourseData(code: string): Course {
	// @ts-expect-error
	return courseData[code] || { code };
}
