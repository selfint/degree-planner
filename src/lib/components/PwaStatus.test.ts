import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import { ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(
	new URL('./PwaStatus.svelte', import.meta.url),
	'utf8'
);
type Node = {
	type?: string;
	start: number;
	end: number;
	id?: { name: string };
};
function findRegistration(value: unknown): Node | undefined {
	if (!value || typeof value !== 'object') return;
	const node = value as Node;
	if (node.type === 'FunctionDeclaration' && node.id?.name === 'registerShell')
		return node;
	for (const child of Object.values(value)) {
		const found = findRegistration(child);
		if (found) return found;
	}
}
const registrationFunction = findRegistration(
	parse(source, { modern: true }).instance
);
if (!registrationFunction)
	throw new Error('Missing actual registerShell function');
// Execute the real component function, substituting only the build environment.
// Unit dependencies are controlled here; native browser lifecycle tests continue
// to use actual service-worker registrations and never use this harness.
const functionSource = source
	.slice(registrationFunction.start, registrationFunction.end)
	.replaceAll('import.meta.env.PROD', 'production');
const createRegistration = new Function(
	'navigator',
	'setShell',
	'reconcileUpdateReady',
	'watchWorker',
	'checkShell',
	'setTimeout',
	'clearTimeout',
	'production',
	transpileModule(
		`
		let disposed = false;
		let registering = false;
		let currentRegistration;
		let controllerTimer;
		const watchedRegistrations = new WeakSet();
		const cleanups = [];
		${functionSource}
		return {
			register: registerShell,
			dispose: () => { disposed = true; },
			current: () => currentRegistration,
			registering: () => registering,
			cleanup: () => cleanups.forEach(cleanup => cleanup())
		};
	`,
		{ compilerOptions: { target: ScriptTarget.ES2022 } }
	).outputText
) as (
	navigator: object,
	setShell: (...args: unknown[]) => void,
	reconcile: () => void,
	watch: (...args: unknown[]) => void,
	check: () => void,
	timer: (...args: unknown[]) => unknown,
	clearTimer: (...args: unknown[]) => void,
	production: boolean
) => {
	register: () => Promise<void>;
	dispose: () => void;
	current: () => unknown;
	registering: () => boolean;
	cleanup: () => void;
};

function harness() {
	const serviceWorker = {
		register: vi.fn(),
		ready: { then: vi.fn() },
		controller: null
	};
	const setShell = vi.fn();
	const reconcile = vi.fn();
	const watch = vi.fn();
	const check = vi.fn();
	const timer = vi.fn();
	const clearTimer = vi.fn();
	const lifecycle = createRegistration(
		{ serviceWorker },
		setShell,
		reconcile,
		watch,
		check,
		timer,
		clearTimer,
		true
	);
	return { serviceWorker, setShell, reconcile, watch, check, timer, lifecycle };
}
function registration() {
	return {
		waiting: null,
		installing: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	};
}
const registrationError = 'registration';

describe('actual offline shell registration result handling', () => {
	it.each([undefined, null])(
		'reports a missing %s result before consuming it',
		async (result) => {
			const h = harness();
			h.serviceWorker.register.mockResolvedValue(result);
			await h.lifecycle.register();
			expect(h.setShell).toHaveBeenCalledExactlyOnceWith(
				'unavailable',
				registrationError
			);
			expect(h.lifecycle.current()).toBeUndefined();
			expect(h.lifecycle.registering()).toBe(false);
			expect(h.reconcile).not.toHaveBeenCalled();
			expect(h.watch).not.toHaveBeenCalled();
			expect(h.check).not.toHaveBeenCalled();
			expect(h.timer).not.toHaveBeenCalled();
			expect(h.serviceWorker.ready.then).not.toHaveBeenCalled();
		}
	);

	it('allows an explicit retry to use the returned registration without substitution', async () => {
		const h = harness();
		const valid = registration();
		h.serviceWorker.register
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(valid);
		await h.lifecycle.register();
		await h.lifecycle.register();
		expect(h.serviceWorker.register).toHaveBeenCalledTimes(2);
		expect(h.serviceWorker.register).toHaveBeenLastCalledWith(
			'/service-worker.js',
			{
				scope: '/app/',
				updateViaCache: 'none'
			}
		);
		expect(h.lifecycle.current()).toBe(valid);
		expect(h.lifecycle.registering()).toBe(false);
		expect(h.setShell).toHaveBeenCalledExactlyOnceWith(
			'unavailable',
			registrationError
		);
		expect(h.watch).toHaveBeenCalledWith(valid, valid.waiting);
		expect(valid.addEventListener).toHaveBeenCalledExactlyOnceWith(
			'updatefound',
			expect.any(Function)
		);
		expect(h.check).toHaveBeenCalledOnce();
		expect(h.timer).toHaveBeenCalledExactlyOnceWith(
			expect.any(Function),
			30_000
		);
		expect(h.serviceWorker.ready.then).toHaveBeenCalledOnce();
		h.lifecycle.cleanup();
		expect(valid.removeEventListener).toHaveBeenCalledExactlyOnceWith(
			'updatefound',
			valid.addEventListener.mock.calls[0][1]
		);
	});

	it('reports a stable reason instead of leaking native registration rejection text', async () => {
		const h = harness();
		h.serviceWorker.register.mockRejectedValue(
			new Error('Registration denied by browser policy.')
		);
		await h.lifecycle.register();
		expect(h.setShell).toHaveBeenCalledExactlyOnceWith(
			'unavailable',
			'registration'
		);
		expect(h.lifecycle.registering()).toBe(false);
		expect(h.watch).not.toHaveBeenCalled();
	});

	it('ignores a missing result after disposal', async () => {
		const h = harness();
		let finish!: (value: undefined) => void;
		h.serviceWorker.register.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const pending = h.lifecycle.register();
		h.lifecycle.dispose();
		finish(undefined);
		await pending;
		expect(h.setShell).not.toHaveBeenCalled();
		expect(h.lifecycle.current()).toBeUndefined();
		expect(h.lifecycle.registering()).toBe(false);
		expect(h.watch).not.toHaveBeenCalled();
	});
});
