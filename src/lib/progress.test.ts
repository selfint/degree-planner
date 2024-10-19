import { describe, it, expect } from 'vitest';

import { getProgress, requirementCompleted } from './progress';

function getCourseData(code: string): Course {
	return { code, points: parseInt(code) };
}

function buildSemesters(semesters: string[][]): Course[][] {
	return semesters.map((semester) => semester.map(getCourseData));
}

describe('Progress', () => {
	it('should apply overflow', () => {
		const semesters = buildSemesters([['1', '2']]);
		const requirement: Requirement = {
			name: 'base',
			nested: [
				{
					name: 'overflow_target',
					points: 1
				},
				{
					name: 'core',
					points: 2,
					courses: ['1', '2'],
					overflow: 'overflow_target'
				}
			]
		};

		const progress = getProgress(semesters, requirement, getCourseData);

		expect(progress.nested.done.length).toEqual(2);
		expect(progress.nested.options.length).toEqual(2);
		expect(progress.nested.done.filter(requirementCompleted).length).toEqual(2);
		expect(requirementCompleted(progress.nested.options[1])).toBeTruthy();
		expect(progress.nested.options[1]).toMatchSnapshot();
	});

	it('should return count progress', () => {
		const semesters = buildSemesters([['1', '2']]);
		const requirement: Requirement = {
			name: 'base',
			count: 2,
			courses: ['1', '2']
		};

		const progress = getProgress(semesters, requirement, getCourseData);

		expect(progress.count.done).toEqual(2);
		expect(requirementCompleted(progress)).toBeTruthy();
		expect(progress).toMatchSnapshot();
	});
});
