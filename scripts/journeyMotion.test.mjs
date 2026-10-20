import { describe, expect, it, vi } from 'vitest';
vi.mock('../tutorials/helpers/motion', () => ({
	revealTarget: vi.fn(),
	approachTarget: vi.fn()
}));
import { revealTarget, approachTarget } from '../tutorials/helpers/motion';
import { journeyAction } from '../tests/helpers/journey-motion';

describe('journey capture action pacing', () => {
	it('normal tests invoke the original action without inspecting or delaying the page', async () => {
		const target = {};
		const action = vi.fn().mockResolvedValue(['unchanged']);
		expect(await journeyAction(target, action, false)).toEqual(['unchanged']);
		expect(action).toHaveBeenCalledWith(target);
		expect(revealTarget).not.toHaveBeenCalled();
		expect(approachTarget).not.toHaveBeenCalled();
	});
	it('reveals then approaches before the real action, with readable holds', async () => {
		const events = [];
		const page = { waitForTimeout: async (ms) => events.push(ms) };
		const target = { page: () => page };
		revealTarget.mockImplementationOnce(async () => events.push('reveal'));
		approachTarget.mockImplementationOnce(async () => events.push('approach'));
		const value = await journeyAction(
			target,
			async (received) => {
				expect(received).toBe(target);
				events.push('real action');
				return 'result';
			},
			true
		);
		expect(value).toBe('result');
		expect(events).toEqual(['reveal', 'approach', 350, 'real action', 550]);
	});
	it('does not swallow failed real actions or manufacture success', async () => {
		const page = { waitForTimeout: vi.fn() };
		await expect(
			journeyAction(
				{ page: () => page },
				async () => {
					throw new Error('real failure');
				},
				true
			)
		).rejects.toThrow('real failure');
	});
});

it('guards every journey input action and avoids global per-frame slowMo', async () => {
	const { readFileSync } = await import('node:fs');
	const ts = await import('typescript');
	const source = readFileSync(
		new URL('../tests/student-journeys.test.ts', import.meta.url),
		'utf8'
	);
	const tree = ts.createSourceFile(
		'journeys.ts',
		source,
		ts.ScriptTarget.Latest,
		true
	);
	let actions = 0;
	function visit(node) {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			['click', 'selectOption', 'fill', 'press'].includes(
				node.expression.name.text
			)
		) {
			actions++;
			expect(node.expression.expression.getText(tree)).toBe('target');
			let parent = node.parent;
			while (
				parent &&
				!(
					ts.isCallExpression(parent) &&
					parent.expression.getText(tree) === 'journeyAction'
				)
			)
				parent = parent.parent;
			expect(parent, 'action needs capture-only guard').toBeTruthy();
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	expect(actions).toBe(31);
	const config = readFileSync(
		new URL('../playwright.journeys.config.ts', import.meta.url),
		'utf8'
	);
	expect(config).toContain('slowMo: 0');
});
