import { describe, it, expect } from 'vitest';

import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { getName, getConnections, getPoints } from './courseInfo';

describe('Course Info', () => {
	it('Gets the course points', async () => {
		const doc = new JSDOM(readFileSync(resolve(__dirname, 'course_234218.html'), 'utf-8')).window
			.document;

		const points = getPoints(doc);
		expect(points).toBeDefined();
		expect(points).toStrictEqual(3);
	});

	it('Gets the course name', async () => {
		const doc = new JSDOM(readFileSync(resolve(__dirname, 'course_234218.html'), 'utf-8')).window
			.document;

		const name = getName('234218', doc);

		expect(name).toBeDefined();
		expect(name).toStrictEqual('234218 - מבני נתונים 1');
	});

	it('Get the course connections', async () => {
		const doc = new JSDOM(readFileSync(resolve(__dirname, 'course_234218.html'), 'utf-8')).window
			.document;

		const connections = getConnections(doc);

		expect(connections).toBeDefined();
		expect(connections?.dependencies).toStrictEqual([
			['104286', '234122'],
			['104286', '234124'],
			['234122', '234141'],
			['234124', '234141']
		]);
		expect(connections?.adjacent).toStrictEqual(['94412', '104034', '104222']);
		expect(connections?.exclusive).toStrictEqual([
			'44268',
			'94223',
			'94224',
			'104918',
			'234268',
			'35015'
		]);
	});
});
