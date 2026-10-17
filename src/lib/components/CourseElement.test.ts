import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
	new URL('./CourseElement.svelte', import.meta.url),
	'utf8'
);
const component = parse(source, { modern: true });
type Node = {
	type?: string;
	name?: string;
	start?: number;
	end?: number;
	[key: string]: unknown;
};
function elements(value: unknown): Node[] {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value)) return value.flatMap(elements);
	const node = value as Node;
	return [
		...(node.type === 'RegularElement' ? [node] : []),
		...Object.values(node).flatMap(elements)
	];
}
function hasClass(node: Node, name: string) {
	return (
		node.attributes as {
			type: string;
			name: string;
			value: { type: string; data: string }[];
		}[]
	).some(
		(attribute) =>
			attribute.type === 'Attribute' &&
			attribute.name === 'class' &&
			attribute.value.some(
				(part) => part.type === 'Text' && part.data.split(/\s+/).includes(name)
			)
	);
}
function element(name: string, root: unknown = component) {
	const result = elements(root).find((node) => hasClass(node, name));
	if (!result) throw new Error(`Missing ${name}`);
	return result;
}

describe('original shared course-card content hierarchy', () => {
	it('keeps marker/note and median/points in the first metadata row, including squeezed cards', () => {
		const meta = element('course-meta');
		expect(element('course-markers', meta)).toBeDefined();
		expect(element('course-note', meta)).toBeDefined();
		const stats = element('course-stats', meta);
		expect(element('course-median', stats).start).toBeLessThan(
			element('course-points', stats).start!
		);
		expect(meta.start).toBeLessThan(element('course-copy').start!);
		expect(source.slice(meta.start, meta.end)).not.toContain('squeeze');
	});

	it('keeps the full name and code as inline siblings in one copy block', () => {
		const copy = element('course-copy');
		const name = element('course-name', copy);
		const code = element('course-code', copy);
		expect(name.name).toBe('span');
		expect(code.name).toBe('span');
		expect(name.start).toBeLessThan(code.start!);
		expect(source.slice(name.start, name.end)).toContain('title={course.name}');
		expect(source.slice(name.start, name.end)).not.toContain('{code}');
		expect(source.slice(copy.start, copy.end)).not.toContain('line-clamp');
	});

	it('puts the disclosure after the body and optional exam information, without nesting buttons', () => {
		const open = element('course-open');
		const warning = element('course-warning');
		expect(warning.start).toBeGreaterThan(open.end!);
		expect(warning.start).toBeGreaterThan(element('course-footer').end!);
		expect(
			elements(open).filter((node) => node.name === 'button')
		).toHaveLength(1);
		expect(source.slice(warning.start, warning.end)).toContain(
			'aria-expanded={!minimize}'
		);
		expect(source).toContain(
			'if (minimize && scheduleErrorButton) minimize = false;'
		);
		expect(source).toContain('else onOpen?.();');
	});
});

it('limits decorative hover to fine pointers without limiting keyboard focus', () => {
	const hover = component.css?.children.find(
		(node) =>
			node.type === 'Atrule' &&
			node.name === 'media' &&
			node.prelude === '(hover: hover) and (pointer: fine)'
	);
	expect(hover).toBeDefined();
	const hoverRules = source.slice(hover!.start, hover!.end);
	expect(hoverRules).toContain('.course-card:hover');
	expect(hoverRules).toContain('.course-warning:hover');
	expect(hoverRules).not.toContain(':focus-visible');
	expect(source).toContain('.course-warning:focus-visible');
});
