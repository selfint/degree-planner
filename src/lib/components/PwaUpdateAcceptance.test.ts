import { readFileSync } from 'node:fs';
import { ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { readWaitingWorkerVersion } from '../pwa/service-worker-update';
import {
	requestUpdateActivation,
	waitForUpdateController
} from '../pwa/update-activation';
import { pwaMessages } from '../pwa/messages';

// Execute the production acceptance function. Only its platform dependencies are
// controlled here; native worker/immutable-build transitions remain browser tests.
const source = readFileSync(
	new URL('./PwaStatus.svelte', import.meta.url),
	'utf8'
);
const start = source.indexOf('acceptUpdate = async () => {');
const end = source.indexOf('let controllerTimer:', start);
if (start < 0 || end < 0)
	throw new Error('Missing production acceptance action');
const make = new Function(
	'navigator',
	'window',
	'updateSafety',
	'readWaitingWorkerVersion',
	'requestUpdateActivation',
	'waitForUpdateController',
	'pwaMessages',
	transpileModule(
		`
let disposed = false, updateBusy = false, reloadStarted = false;
let updateActionError, acceptedUpdate;
let updateVersion = 'v2';
const content = {lang:{lang:'en'}};
const currentRegistration = navigator.registration;
let acceptUpdate;
${source.slice(start, end)}
return {accept: () => acceptUpdate(), state: () => ({updateBusy,updateActionError,acceptedUpdate}), dispose: () => {disposed=true;}};
`,
		{ compilerOptions: { target: ScriptTarget.ES2022 } }
	).outputText
);

function harness(status = 'accepted') {
	let dirty = false;
	let beforeReply = () => {};
	const controller = new EventTarget() as EventTarget & { controller: object };
	controller.controller = {};
	const target = {
		state: 'installed',
		postMessage: vi.fn((message, ports) => {
			if (message.type === 'GET_OFFLINE_SHELL_VERSION')
				ports[0].postMessage({ type: 'OFFLINE_SHELL_VERSION', version: 'v2' });
			else {
				beforeReply();
				if (status === 'accepted') {
					controller.controller = target;
					controller.dispatchEvent(new Event('controllerchange'));
				}
				ports[0].postMessage({
					type: 'UPDATE_ACTIVATION',
					version: 'v2',
					status
				});
			}
		})
	};
	const reload = vi.fn();
	const action = make(
		{ serviceWorker: controller, registration: { waiting: target } },
		{ location: { reload } },
		{ blocked: () => dirty },
		readWaitingWorkerVersion,
		requestUpdateActivation,
		waitForUpdateController,
		pwaMessages
	);
	return {
		...action,
		reload,
		target,
		setDirty: (value: boolean) => {
			dirty = value;
		},
		onReply: (fn: () => void) => {
			beforeReply = fn;
		}
	};
}

describe('accepting a PWA update', () => {
	it('does not contact a worker while a draft or pending/failed write blocks reload', async () => {
		const h = harness();
		h.setDirty(true);
		await h.accept();
		expect(h.target.postMessage).not.toHaveBeenCalled();
		expect(h.reload).not.toHaveBeenCalled();
	});
	it('reloads exactly once after explicit acceptance, even with repeated clicks', async () => {
		const h = harness();
		await Promise.all([h.accept(), h.accept()]);
		await h.accept();
		expect(h.reload).toHaveBeenCalledOnce();
	});
	it('reports other tabs without reload and permits a later retry', async () => {
		const h = harness('other-tabs');
		await h.accept();
		expect(h.reload).not.toHaveBeenCalled();
		expect(h.state().updateActionError).toBe(pwaMessages.en.updateOtherTabs);
		expect(h.state().updateBusy).toBe(false);
	});
	it('preserves a draft created during activation and retries the active version explicitly', async () => {
		const h = harness();
		h.onReply(() => h.setDirty(true));
		await h.accept();
		expect(h.reload).not.toHaveBeenCalled();
		expect(h.state().acceptedUpdate.version).toBe('v2');
		h.setDirty(false);
		await h.accept();
		expect(h.reload).toHaveBeenCalledOnce();
	});
	it('does not reload when its owning component was disposed during activation', async () => {
		const h = harness();
		h.onReply(() => h.dispose());
		await h.accept();
		expect(h.reload).not.toHaveBeenCalled();
	});
});
