import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { parse } from 'svelte/compiler';
import { render } from 'svelte/server';
import { transpileModule, ScriptTarget } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import Semester from './Semester.svelte';

const locale = vi.hoisted(() => ({ lang: 'en' as 'en' | 'he' }));
vi.mock('$lib/stores.svelte', async () => {
	const { cms } = await import('../content');
	return {
		content: {
			get lang() {
				return cms[locale.lang];
			}
		}
	};
});

const source = readFileSync(
	new URL('./Semester.svelte', import.meta.url),
	'utf8'
);
const component = parse(source, { modern: true });
type Node = {
	type: string;
	start: number;
	end: number;
	[key: string]: unknown;
};
function nodes(value: unknown): Node[] {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value)) return value.flatMap(nodes);
	const node = value as Node;
	return [...(node.type ? [node] : []), ...Object.values(node).flatMap(nodes)];
}
function find(
	type: string,
	root: unknown,
	predicate?: (node: Node) => boolean
) {
	const node = nodes(root).find(
		(node) => node.type === type && (!predicate || predicate(node))
	);
	if (!node) throw new Error(`Missing ${type}`);
	return node;
}
function element(className: string, root: unknown = component.fragment) {
	return find('RegularElement', root, (node) =>
		nodes(node.attributes).some(
			(attribute) =>
				attribute.type === 'Attribute' &&
				attribute.name === 'class' &&
				nodes(attribute.value).some(
					(part) =>
						part.type === 'Text' &&
						String(part.data).split(/\s+/).includes(className)
				)
		)
	);
}
const code = (node: Node) => source.slice(node.start, node.end);
function execute<T>(body: string, args: string[] = []): T {
	return new Function(
		...args,
		transpileModule(body, {
			compilerOptions: { target: ScriptTarget.ES2022 }
		}).outputText
	) as T;
}

// Execute the actual component expressions, not a second implementation of its
// math. Browser regressions separately verify visible values and geometry.
const averageFunction = find(
	'FunctionDeclaration',
	component.instance,
	(node) => (node.id as { name: string }).name === 'getAvgMedian'
);
const getAvgMedian = execute<() => (courses: Course[]) => number>(
	`${code(averageFunction)}; return getAvgMedian;`
)();
const effectiveDeclaration = find(
	'VariableDeclarator',
	component.instance,
	(node) => (node.id as { name: string }).name === 'effectiveSemester'
);
const resolveEffective = execute<
	(
		semester: string[],
		disabled: string[] | undefined,
		getCourseData: GetCourseData
	) => Promise<Course[]>
>(
	`return (${code(find('ArrowFunctionExpression', effectiveDeclaration))})();`,
	['semester', 'disabled', 'getCourseData']
);
const selectors = ['semester-tests', 'semester-median', 'semester-points'];
function metric(className: string, courses: Course[]) {
	const block = find('AwaitBlock', element(className));
	expect(code(block.expression as Node)).toBe('effectiveSemester');
	const expression = find('ExpressionTag', block.then).expression as Node;
	return execute<(courses: Course[], average: typeof getAvgMedian) => number>(
		`return (${code(expression)});`,
		['effectiveSemester', 'getAvgMedian']
	)(courses, getAvgMedian);
}
const summaries = (courses: Course[]) =>
	selectors.map((name) => metric(name, courses));
const testDate = { year: 2026, monthIndex: 6, day: 1 };
const courses: Course[] = [
	{
		code: '00000001' as CourseCode,
		median: 86,
		points: 4,
		tests: [testDate, testDate]
	},
	{
		code: '00000002' as CourseCode,
		median: 78,
		points: 3,
		tests: [testDate, testDate]
	},
	{ code: '00000003' as CourseCode, median: 92, points: 2 }
];

describe('original semester summary calculations', () => {
	it('counts tests once per examined course, not courses or exam sittings', () => {
		expect(summaries(courses)).toEqual([2, 85.3, 9]);
		expect(
			metric('semester-tests', [
				...courses,
				// Legacy data can contain an empty array despite the current tuple type.
				{
					code: '00000004' as CourseCode,
					tests: [] as unknown as Course['tests']
				},
				{ code: '00000005' as CourseCode, tests: [testDate, null] }
			])
		).toBe(3);
	});

	it('averages only defined medians, without credit weighting or excluding zero', () => {
		expect(
			summaries([
				{ code: '00000001' as CourseCode, median: 0, points: 5.5 },
				{ code: '00000002' as CourseCode, median: 91, points: 1.5 },
				{ code: '00000003' as CourseCode, points: 0.5 }
			])
		).toEqual([0, 45.5, 7.5]);
	});

	it('retains the original zero totals for empty or missing summary fields', () => {
		// a4c4dc8e Semester.svelte:43–50 explicitly returns 0 with no medians.
		expect(summaries([])).toEqual([0, 0, 0]);
		expect(summaries([{ code: '00000001' as CourseCode }])).toEqual([0, 0, 0]);
	});

	it('excludes disabled courses from every summary before fetching them', async () => {
		const getCourseData = vi.fn(async (code: string) => {
			const course = courses.find((course) => course.code === code);
			if (!course) throw new Error(`Unknown course ${code}`);
			return course;
		});
		const effective = await resolveEffective(
			courses.map((course) => course.code),
			[courses[0].code],
			getCourseData
		);
		expect(summaries(effective)).toEqual([1, 85, 5]);
		expect(getCourseData.mock.calls.map(([code]) => code)).toEqual([
			courses[1].code,
			courses[2].code
		]);
	});

	it('waits for actual data and propagates failures instead of inventing totals', async () => {
		let complete!: (course: Course) => void;
		const pending = new Promise<Course>((resolve) => {
			complete = resolve;
		});
		const settled = vi.fn();
		const effective = resolveEffective(
			[courses[0].code],
			undefined,
			() => pending
		);
		void effective.then(settled);
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
		complete(courses[0]);
		expect(summaries(await effective)).toEqual([1, 86, 4]);
		const error = new Error('Course lookup failed');
		await expect(
			resolveEffective([courses[0].code], undefined, async () => {
				throw error;
			})
		).rejects.toBe(error);
	});
});

describe('compact semester metric strip', () => {
	for (const language of ['en', 'he'] as const) {
		it(`renders three ordered numeric slots with localized tooltips in ${language}`, () => {
			locale.lang = language;
			const { body } = render(Semester, {
				props: {
					getCourseData: () => new Promise<Course>(() => {}),
					index: 0,
					isCurrent: false,
					semester: [],
					board: true,
					children: createRawSnippet(() => ({ render: () => '<span></span>' }))
				}
			});
			const html = parse(body, { modern: true });
			const summary = element('semester-summary', html.fragment);
			const children = (node: Node) =>
				(node.fragment as { nodes: Node[] }).nodes;
			const attribute = (node: Node, name: string) =>
				nodes(
					find('Attribute', node.attributes, (node) => node.name === name).value
				)
					.filter((node) => node.type === 'Text')
					.map((node) => node.data)
					.join('');
			const metrics = children(summary).filter(
				(node) => node.type === 'RegularElement'
			);
			expect(
				metrics.map((node) => attribute(node, 'class').split(' ')[0])
			).toEqual(selectors);
			expect(metrics.map((node) => attribute(node, 'title'))).toEqual(
				language === 'en'
					? ['Tests', 'Average median', 'Points']
					: ['מבחנים', 'ממוצע חציונים', 'נקודות']
			);
			for (const node of metrics) {
				expect(element('sr-only', node)).toBeDefined();
				const visibleText = children(node)
					.filter((node) => node.type === 'Text')
					.map((node) => node.data)
					.join('')
					.trim();
				expect(visibleText).toBe('-');
			}
			expect(
				nodes(summary).some((node) =>
					['button', 'details', 'select'].includes(String(node.name))
				)
			).toBe(false);
			expect(element('semester-column--board', html.fragment)).toBeDefined();
			expect(element('semester-exams-row', html.fragment)).toBeDefined();
			expect(
				attribute(element('semester-courses', html.fragment), 'data-semester')
			).toBe('0');
		});
	}

	it('retains the original responsive heading alignment and inline metric order', () => {
		expect(code(element('semester-heading'))).toContain(
			'flex w-full flex-col items-start justify-between sm:flex-row'
		);
		expect(code(element('semester-summary'))).toContain(
			'flex flex-row items-baseline justify-end text-content-secondary'
		);
		for (const name of selectors.slice(0, 2))
			expect(code(element(name))).toContain('me-1');
		expect(source).toContain('grid-template-rows: subgrid;');
		expect(source).toContain('use:makePlanSortable={sortable}');
		expect(source).not.toContain('flex-wrap: wrap;');
	});
});
