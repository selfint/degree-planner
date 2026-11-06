import { describe, expect, it } from 'vitest';
import { load } from './+layout';

async function lookupFrom(data: unknown): Promise<GetCourseData> {
	const result = await load({
		fetch: async () => new Response(JSON.stringify(data)),
		data: null,
		params: {},
		route: { id: '/app/(withCourseData)' },
		url: new URL('https://example.test/app/plan'),
		setHeaders: () => {},
		depends: () => {},
		untrack: (fn) => fn(),
		parent: async () => {
			throw new Error('Course lookup must not depend on personal plan data');
		},
		tracing: {
			enabled: false,
			get root(): never {
				throw new Error('Tracing is not enabled in this fixture');
			},
			get current(): never {
				throw new Error('Tracing is not enabled in this fixture');
			}
		}
	});
	return result?.getCourseData;
}

describe('runtime course lookup', () => {
	it('loads a refreshed course absent from the bundled snapshot', async () => {
		const course: Course = {
			code: '09999998',
			name: 'New fictional catalog course',
			points: 3
		};
		const getCourseData = await lookupFrom({ [course.code]: course });
		await expect(getCourseData(course.code)).resolves.toEqual(course);
	});

	it('preserves missing persisted course codes as placeholders', async () => {
		const getCourseData = await lookupFrom({
			'09999998': { code: '09999998', name: 'New fictional catalog course' }
		});
		await expect(getCourseData('09999999')).resolves.toEqual({
			code: '09999999'
		});
	});

	it('still rejects malformed downloaded course data', async () => {
		const getCourseData = await lookupFrom({
			'09999998': { code: '09999998', points: 'not a number' }
		});
		await expect(getCourseData('09999998')).rejects.toThrow();
	});
});
