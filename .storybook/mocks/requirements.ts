import { requirementFixture, pending } from '../fixtures';
import { scenario } from './stores.svelte';
export const loadRequirement = async () =>
	scenario.loading
		? pending<Requirement>()
		: scenario.pathChoices
			? {
					...requirementFixture,
					nested: [
						{
							name: 'example-path',
							en: 'Example path',
							he: 'מסלול לדוגמה',
							courses: []
						},
						{
							name: 'other-path',
							en: 'Alternate path',
							he: 'מסלול נוסף',
							courses: []
						}
					]
				}
			: requirementFixture;
export const loadDegreeName = async (lang: string) =>
	lang === 'he' ? 'תואר לדוגמה' : 'Example degree';
export function getDegreeRequirementCourses(requirement: Requirement) {
	const visit = (
		r: Requirement,
		path: Requirement[]
	): { path: Requirement[]; courses: CourseCode[] }[] => [
		...(r.courses ? [{ path: [...path, r], courses: r.courses }] : []),
		...(r.nested ?? []).flatMap((n) => visit(n, [...path, r]))
	];
	return (requirement.nested ?? []).flatMap((r) => visit(r, []));
}
export const getCourseLists = (r: Requirement | undefined, code: CourseCode) =>
	r
		? getDegreeRequirementCourses(r)
				.filter((group) => group.courses.includes(code))
				.map((group) => group.path)
		: [];
