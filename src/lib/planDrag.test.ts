import Sortable from 'sortablejs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	instances: [] as {
		options: Sortable.Options;
		option: ReturnType<typeof vi.fn>;
		destroy: ReturnType<typeof vi.fn>;
	}[]
}));
vi.mock('sortablejs', () => ({
	default: class {
		static ghost = undefined;
		option = vi.fn();
		destroy = vi.fn();
		constructor(
			_element: HTMLElement,
			public options: Sortable.Options
		) {
			mocked.instances.push(this);
		}
	}
}));
import { makePlanSortable } from './planDrag';

// Only DOM ordering is relevant here; Sortable itself is covered by browser tests.
class NodeStub {
	parentNode: NodeStub | null = null;
	children: NodeStub[] = [];
	get nextSibling(): NodeStub | null {
		const siblings = this.parentNode?.children ?? [];
		return siblings[siblings.indexOf(this) + 1] ?? null;
	}
	insertBefore(item: NodeStub, next: NodeStub | null) {
		if (item.parentNode)
			item.parentNode.children = item.parentNode.children.filter(
				(child) => child !== item
			);
		const index = next ? this.children.indexOf(next) : this.children.length;
		this.children.splice(index, 0, item);
		item.parentNode = this;
	}
}
let network: { onLine: boolean };
let events: EventTarget;
let cleanups: (() => void)[];
function create(node: NodeStub, options: Sortable.Options = {}) {
	const action = makePlanSortable(node as unknown as HTMLElement, options)!;
	cleanups.push(action.destroy);
	return mocked.instances.at(-1)!;
}
function connect(online: boolean) {
	network.onLine = online;
	events.dispatchEvent(new Event(online ? 'online' : 'offline'));
}
function event(item: NodeStub, from: NodeStub, to = from) {
	return { item, from, to } as unknown as Sortable.SortableEvent;
}
function invoke(
	instance: (typeof mocked.instances)[number],
	name: 'onStart' | 'onAdd' | 'onUpdate' | 'onEnd',
	value: Sortable.SortableEvent
) {
	instance.options[name]?.call(instance as unknown as Sortable, value);
}
beforeEach(() => {
	mocked.instances.length = 0;
	cleanups = [];
	network = { onLine: true };
	events = new EventTarget();
	vi.stubGlobal('navigator', network);
	vi.stubGlobal('window', events);
	Sortable.ghost = undefined as unknown as HTMLElement;
});
afterEach(() => {
	cleanups.forEach((cleanup) => cleanup());
	vi.unstubAllGlobals();
});

describe('offline plan drag protection', () => {
	it('does not make a read-only preview sortable', () => {
		expect(
			makePlanSortable(new NodeStub() as unknown as HTMLElement)
		).toBeUndefined();
		expect(mocked.instances).toHaveLength(0);
	});

	it('disables existing and newly mounted sortables offline and re-enables on reconnect', () => {
		const instance = create(new NodeStub());
		connect(false);
		expect(instance.option).toHaveBeenLastCalledWith('disabled', true);
		const second = create(new NodeStub());
		expect(second.options.disabled).toBe(true);
		connect(true);
		expect(instance.option).toHaveBeenLastCalledWith('disabled', false);
		expect(second.option).toHaveBeenLastCalledWith('disabled', false);
	});

	it('preserves an explicit caller disable even when online', () => {
		const instance = create(new NodeStub(), { disabled: true });
		connect(false);
		connect(true);
		expect(instance.option).toHaveBeenLastCalledWith('disabled', true);
	});

	it('restores an interrupted cross-list drag and never calls its mutation callback', () => {
		const source = new NodeStub();
		const target = new NodeStub();
		const first = new NodeStub();
		const second = new NodeStub();
		source.insertBefore(first, null);
		source.insertBefore(second, null);
		const sourceInstance = create(source);
		const onAdd = vi.fn();
		const targetInstance = create(target, { onAdd });
		invoke(sourceInstance, 'onStart', event(first, source));
		target.insertBefore(first, null);
		connect(false);
		invoke(targetInstance, 'onAdd', event(first, source, target));
		invoke(sourceInstance, 'onEnd', event(first, source, target));
		expect(onAdd).not.toHaveBeenCalled();
		expect(source.children).toEqual([first, second]);
		expect(target.children).toEqual([]);
	});

	it('cancels an interrupted reorder even if reconnect happens before the drop', () => {
		const source = new NodeStub();
		const first = new NodeStub();
		const second = new NodeStub();
		source.insertBefore(first, null);
		source.insertBefore(second, null);
		const onUpdate = vi.fn();
		const instance = create(source, { onUpdate });
		invoke(instance, 'onStart', event(first, source));
		source.insertBefore(first, null);
		connect(false);
		connect(true);
		invoke(instance, 'onUpdate', event(first, source));
		invoke(instance, 'onEnd', event(first, source));
		expect(onUpdate).not.toHaveBeenCalled();
		expect(source.children).toEqual([first, second]);
		// Reconnection permits a fresh drag, never replays the interrupted one.
		invoke(instance, 'onStart', event(first, source));
		invoke(instance, 'onUpdate', event(first, source));
		invoke(instance, 'onEnd', event(first, source));
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it('checks connectivity before mutating even without an offline event', () => {
		const onAdd = vi.fn();
		const onUpdate = vi.fn();
		const instance = create(new NodeStub(), { onAdd, onUpdate });
		network.onLine = false;
		invoke(instance, 'onAdd', event(new NodeStub(), new NodeStub()));
		invoke(instance, 'onUpdate', event(new NodeStub(), new NodeStub()));
		expect(onAdd).not.toHaveBeenCalled();
		expect(onUpdate).not.toHaveBeenCalled();
	});
});

describe('interrupted fallback drag cleanup', () => {
	it('consumes a stale suppression guard without consuming the next navigation click', () => {
		const document = new EventTarget();
		vi.stubGlobal('document', document);
		vi.stubGlobal('MouseEvent', Event);
		let suppressNextClick = true;
		const dispatched = vi.spyOn(document, 'dispatchEvent');
		document.addEventListener(
			'click',
			(event) => {
				if (suppressNextClick) {
					event.preventDefault();
					suppressNextClick = false;
				}
			},
			true
		);
		const source = new NodeStub();
		const course = new NodeStub();
		source.insertBefore(course, null);
		const onUpdate = vi.fn();
		const instance = create(source, { onUpdate });
		invoke(instance, 'onStart', event(course, source));
		const removeGhost = vi.fn();
		Sortable.ghost = { remove: removeGhost } as unknown as HTMLElement;

		cleanups[0]();

		expect(instance.destroy).toHaveBeenCalledOnce();
		expect(removeGhost).toHaveBeenCalledOnce();
		expect(onUpdate).not.toHaveBeenCalled();
		expect(dispatched).toHaveBeenCalledOnce();
		const cleanupClick = dispatched.mock.calls[0][0];
		expect(cleanupClick.bubbles).toBe(false);
		expect(cleanupClick.defaultPrevented).toBe(true);
		expect(cleanupClick.target).toBe(document);
		const nextClick = new Event('click', { cancelable: true });
		document.dispatchEvent(nextClick);
		expect(nextClick.defaultPrevented).toBe(false);
	});

	it('does not dispatch a click when idle or after a completed gesture', () => {
		const document = new EventTarget();
		vi.stubGlobal('document', document);
		const dispatched = vi.spyOn(document, 'dispatchEvent');
		create(new NodeStub());
		cleanups[0]();
		expect(dispatched).not.toHaveBeenCalled();
		const source = new NodeStub();
		const course = new NodeStub();
		source.insertBefore(course, null);
		const instance = create(source);
		invoke(instance, 'onStart', event(course, source));
		invoke(instance, 'onEnd', event(course, source));
		Sortable.ghost = { remove: vi.fn() } as unknown as HTMLElement;
		cleanups[1]();
		expect(dispatched).not.toHaveBeenCalled();
	});
});
