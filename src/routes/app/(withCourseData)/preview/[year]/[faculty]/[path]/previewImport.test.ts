import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { navigateFromBrowserShare } from '$lib/browserShareRoutes';

// Execute the actual Svelte event handler, with only storage, confirmation and
// navigation replaced. SSR does not invoke event handlers, and copying its
// transform into a test would risk testing a different implementation.
const component = readFileSync(
	new URL('./+page.svelte', import.meta.url),
	'utf8'
);
const script = component.match(/<script lang="ts">([\s\S]*?)<\/script>/)![1];
const ast = ts.createSourceFile(
	'preview.ts',
	script,
	ts.ScriptTarget.Latest,
	true
);
const declaration = ast.statements.find(
	(node): node is ts.FunctionDeclaration =>
		ts.isFunctionDeclaration(node) && node.name?.text === 'importPlan'
)!;
const handler = ts.transpileModule(declaration.getText(ast), {
	compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const shared = {
	degree: ['2026_200', '00002330', 'SC00001356_CG00011002'],
	userPath: undefined,
	semesters: [['02340124'], [], ['02340141']]
};

async function exercise(
	currentSemester: number,
	confirmed = true,
	semesters = shared.semesters
) {
	const initial = {
		degree: ['2024_200', '00002120', 'SC00001320_CG00006382'],
		path: 'CG00006246',
		semesters: Array.from({ length: 12 }, (_, i) =>
			i === 0 ? ['01040184'] : []
		),
		currentSemester,
		exemptions: ['03240033'],
		wishlist: ['02340124', '01040184']
	};
	const user = { d: structuredClone(initial) };
	const confirm = vi.fn(() => confirmed);
	const writeStorage = vi.fn(async (plan) => structuredClone(plan));
	const setUser = vi.fn((plan) => {
		user.d = plan;
	});
	const goto = vi.fn(async () => {});
	const environment = {
		user,
		data: structuredClone({ ...shared, semesters }),
		content: {
			lang: { preview: { overwriteWarning: 'Overwrite the current plan?' } }
		},
		confirm,
		writeStorage,
		setUser,
		goto,
		navigateFromBrowserShare,
		importError: false
	};
	const invoke = runInNewContext(`${handler}\nimportPlan`, environment);
	await invoke();
	return { initial, ...environment };
}

describe('shared preview import event handler', () => {
	it('rejects a shorter plan before confirmation, writing or navigating', async () => {
		const result = await exercise(11);
		expect(result.user.d).toEqual(result.initial);
		expect(result.confirm).not.toHaveBeenCalled();
		expect(result.writeStorage).not.toHaveBeenCalled();
		expect(result.setUser).not.toHaveBeenCalled();
		expect(result.goto).not.toHaveBeenCalled();
		expect(result.importError).toBe(true);
	});

	it('accepts an explicitly chosen in-range Current while preserving receiver-only fields', async () => {
		const result = await exercise(1);
		expect(result.user.d).toEqual({
			degree: shared.degree,
			path: undefined,
			semesters: shared.semesters,
			currentSemester: 1,
			exemptions: ['03240033'],
			wishlist: ['01040184']
		});
		expect(result.confirm).toHaveBeenCalledOnce();
		expect(result.writeStorage).toHaveBeenCalledOnce();
		expect(result.goto).toHaveBeenCalledWith('/app/plan');
		expect(result.importError).toBe(false);
	});

	it('Cancel preserves the receiver and does not navigate', async () => {
		const result = await exercise(1, false);
		expect(result.user.d).toEqual(result.initial);
		expect(result.writeStorage).not.toHaveBeenCalled();
		expect(result.goto).not.toHaveBeenCalled();
	});

	it.each([-1, 1.5, Number.NaN])(
		'does not silently normalize invalid Current %s',
		async (current) => {
			const result = await exercise(current);
			expect(result.writeStorage).not.toHaveBeenCalled();
			expect(result.importError).toBe(true);
		}
	);

	it('cannot replace a plan with zero imported semesters', async () => {
		const result = await exercise(0, true, []);
		expect(result.writeStorage).not.toHaveBeenCalled();
		expect(result.importError).toBe(true);
	});
});
