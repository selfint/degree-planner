import { describe, expect, it } from 'vitest';
import { keyedItems } from './keyedItems';

describe('keyedItems', () => {
	it('gives repeated identifiers distinct keys without losing any items', () => {
		const values = ['00000001', '00000001', '00000002'];
		const result = keyedItems(values, (value) => value);
		expect(result.map(({ value }) => value)).toEqual(values);
		expect(new Set(result.map(({ key }) => key)).size).toBe(values.length);
	});

	it('retains keys when unrelated items are inserted, removed or reordered', () => {
		const before = keyedItems(['a', 'b', 'a'], (value) => value);
		const after = keyedItems(['b', 'a', 'new', 'a'], (value) => value);
		expect(
			after.filter(({ value }) => value === 'a').map(({ key }) => key)
		).toEqual(
			before.filter(({ value }) => value === 'a').map(({ key }) => key)
		);
		expect(after[0].key).toBe(before[1].key);
	});

	it('distinguishes numeric and textual identifiers and encoded delimiters', () => {
		const result = keyedItems([1, '1', 'a:0', 'a', 'a'], (value) => value);
		expect(new Set(result.map(({ key }) => key)).size).toBe(result.length);
	});

	it('retains domain identity when objects are refreshed', () => {
		const before = keyedItems(
			[{ code: 'a', title: 'old' }],
			(item) => item.code
		);
		const after = keyedItems(
			[{ code: 'a', title: 'new' }],
			(item) => item.code
		);
		expect(after[0].key).toBe(before[0].key);
		expect(after[0].value.title).toBe('new');
	});
});
