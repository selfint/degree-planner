import { getConnections, getName, getPoints, getStudentsPage } from './lib/courseInfo';
import { getMedian } from './lib/courseMedian';
import { parseCatalog } from './lib/catalogParser';

async function loadCourse(code: string): Promise<CourseInfo> {
	const studentPage = await getStudentsPage(code);

	const info: CourseInfo = {
		median: await getMedian(code),
		points: getPoints(studentPage),
		name: getName(studentPage),
		connections: getConnections(studentPage)
	};

	return info;
}

const codes = new Set<string>();
const courses = new Map<string, CourseInfo>();

process.stdin.on('data', (chunk) => {
	parseCatalog(chunk.toString()).forEach((c) => codes.add(c));
});

process.stdin.on('end', async () => {
	for (const code of codes) {
		const info = await loadCourse(code);
		courses.set(code, info);
	}

	console.log(JSON.stringify(Object.fromEntries(courses)));
});
