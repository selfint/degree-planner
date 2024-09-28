import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BATCH_SIZE = 50;

export const POST: RequestHandler = async ({ request, fetch }) => {
	const courses: string[] = await request.json();

	console.log(courses);

	const batches = [];
	for (let i = 0; i < courses.length; i += BATCH_SIZE) {
		batches.push(courses.slice(i, i + BATCH_SIZE));
	}

	const courseInfos: Course[] = [];

	for (const batch of batches) {
		const results: (Course | undefined)[] = await Promise.all(
			batch.map((course) =>
				fetch(`/api/courseInfo/${course}`)
					.then(async (r) => (r.ok ? await r.json() : undefined))
					.catch(() => undefined)
			)
		);

		courseInfos.push(...results.filter((c) => c !== undefined));
	}

	return json(courseInfos);
};
