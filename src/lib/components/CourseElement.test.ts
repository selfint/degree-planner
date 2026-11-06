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

	it('keeps the complete name and title with the code outside the name clamp', () => {
		const copy = element('course-copy');
		const name = element('course-name', copy);
		const code = element('course-code', copy);
		expect(name.name).toBe('span');
		expect(code.name).toBe('span');
		expect(name.start).toBeLessThan(code.start!);
		expect(source.slice(name.start, name.end)).toContain('title={course.name}');
		expect(source.slice(name.start, name.end)).not.toContain('{code}');
		expect(source.slice(name.start, name.end)).toContain('{course.name}');
		expect(code.start).toBeGreaterThan(name.end!);
		expect(source.slice(code.start, code.end)).toContain('{code}');
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

function styles(selector: string) {
	const rule = source.match(new RegExp(`\\.${selector} \\{([^}]+)\\}`));
	if (!rule) throw new Error(`Missing ${selector} styles`);
	return rule[1];
}

it('limits only the name to three lines with native CSS ellipsis', () => {
	const name = styles('course-name');
	expect(name).toContain('display: -webkit-inline-box;');
	expect(name).toContain('-webkit-box-orient: vertical;');
	expect(name).toContain('-webkit-line-clamp: 3;');
	expect(name).toContain('\n\t\tline-clamp: 3;');
	expect(name).toContain('overflow: hidden;');
	for (const selector of [
		'course-copy',
		'course-code',
		'course-body',
		'course-card'
	]) {
		expect(styles(selector)).not.toMatch(/line-clamp|overflow: hidden/);
	}
	const script = source.slice(0, source.indexOf('</script>'));
	expect(script).not.toMatch(
		/getBoundingClientRect|scrollHeight|ResizeObserver|\.slice\(|\.substring\(/
	);
});

it('retains the original text-xs leading-none name/code and text-xs metadata typography', () => {
	// a4c4dc8e used text-xs leading-none for name/code, text-xs for metadata.
	expect(styles('course-copy')).toContain('font-size: 0.75rem;');
	expect(styles('course-copy')).toContain('line-height: 1;');
	expect(styles('course-meta')).toContain('font-size: 0.75rem;');
	expect(styles('course-meta')).toContain('line-height: 1rem;');
	for (const selector of ['course-name', 'course-code', 'course-note']) {
		expect(styles(selector)).not.toMatch(/font-size:|line-height:/);
	}
	for (const selector of ['course-name', 'course-points']) {
		const node = element(selector);
		expect(source.slice(node.start, node.end)).not.toContain('font-medium');
	}
});

it('keeps the equal-height reserve below inline name/number content, not between it', () => {
	expect(styles('course-copy')).toContain('min-block-size: 4.5rem;');
	expect(styles('course-copy')).not.toMatch(/display: flex|flex-direction:/);
	expect(styles('course-code')).not.toMatch(/margin-block-start:|align-self:/);
	expect(styles('course-name')).toContain('max-inline-size: 100%;');
	expect(styles('course-name')).toContain('vertical-align: bottom;');
	expect(styles('course-code')).toContain('display: inline-block;');
	expect(styles('course-code')).toContain('vertical-align: bottom;');
	expect(source).toContain(
		'.course-body-squeezed .course-copy {\n\t\tmin-block-size: 0;'
	);
	expect(styles('course-name')).not.toMatch(
		/(?:min-|max-)?(?:block-size|height):/
	);
});

it('matches the marker to metadata text size while preserving its shape semantics', () => {
	expect(styles('course-marker')).toContain('inline-size: 1em;');
	expect(styles('course-marker')).toContain('block-size: 1em;');
	expect(styles('course-meta')).toContain('align-items: center;');
	expect(source).toContain("hasTest ? 'rounded-full' : 'rounded-sm'");
});
