import { describe, expect, it } from 'vitest';
import { getConnections } from './generateCourseData.mjs';

function sapPrerequisites(rows) {
	return {
		SmPrereq: {
			results: rows.map(([ModuleId, Bracket = '', Operator = ''], i) => ({
				ModuleId,
				Bracket,
				Operator,
				LineNumber: String(i + 1).padStart(3, '0')
			}))
		},
		SmRelations: { results: [] }
	};
}

describe('SAP prerequisite alternatives', () => {
	it('retains either route to Introduction to Engineering Mechanics', () => {
		const raw = sapPrerequisites([
			['01130013', '(', 'OR'],
			['01140077'],
			['00000000', ')']
		]);
		expect(getConnections(raw).dependencies).toEqual([
			['01130013'],
			['01140077']
		]);
	});

	it('requires the shared AND block plus either alternative in the other block', () => {
		const raw = sapPrerequisites([
			['00140405', '(', 'AND'],
			['00140104', '', 'AND'],
			['00140006'],
			['00000000', ')', 'AND'],
			['00140214', '(', 'OR'],
			['00140211'],
			['00000000', ')']
		]);
		expect(getConnections(raw).dependencies).toEqual([
			['00140405', '00140104', '00140006', '00140214'],
			['00140405', '00140104', '00140006', '00140211']
		]);
	});

	it('retains the four source branches for Integrated Chemical Process Design', () => {
		const branches = [
			['00540322', '00540330', '00540321', '00540319', '00540316', '00540309'],
			['00540322', '00540330', '00540319', '00540316', '00540321', '00540324'],
			['00540322', '00540330', '00540319', '00540316', '00540482', '00540309'],
			['00540322', '00540330', '00540319', '00540482', '00540324', '00540316']
		];
		const raw = sapPrerequisites(
			branches.flatMap((group, branch) => [
				...group.map((id, i) => [
					id,
					i === 0 ? '(' : '',
					i === group.length - 1 ? '' : 'AND'
				]),
				['00000000', ')', branch === branches.length - 1 ? '' : 'OR']
			])
		);
		expect(getConnections(raw).dependencies).toEqual(branches);
	});

	it('keeps the mixed AND and OR pairs in the Quantum Optics source', () => {
		const raw = sapPrerequisites([
			['00440140', '(', 'AND'],
			['01140073', '', 'OR'],
			['00440140', '', 'AND'],
			['01150203', '', 'OR'],
			['01140246', '', 'AND'],
			['01140073', '', 'OR'],
			['01140246', '', 'AND'],
			['01150203'],
			['00000000', ')']
		]);
		expect(getConnections(raw).dependencies).toEqual([
			['00440140', '01140073'],
			['00440140', '01150203'],
			['01140246', '01140073'],
			['01140246', '01150203']
		]);
	});

	it('handles operator-only rows and the zero-numbered final bracket', () => {
		const raw = sapPrerequisites([
			['01040065', '('],
			['00000000', ')'],
			['00000000', '', 'OR'],
			['01040016', '('],
			['00000000', ')'],
			['00000000', '', 'OR'],
			['01040166', '('],
			['00000000', ')']
		]);
		raw.SmPrereq.results.at(-1).LineNumber = '000';
		expect(getConnections(raw).dependencies).toEqual([
			['01040065'],
			['01040016'],
			['01040166']
		]);
	});

	it('does not guess a missing connector between two course rows', () => {
		const raw = sapPrerequisites([
			['01130013', '('],
			['01140077'],
			['00000000', ')']
		]);
		expect(() => getConnections(raw)).toThrow(
			'Missing closing prerequisite bracket'
		);
	});

	it('preserves no-prerequisite and exclusivity behavior', () => {
		const raw = sapPrerequisites([]);
		raw.SmRelations.results = [
			{ Otjid: 'SM01130013', ZzRelationshipKey: 'AZEC' },
			{ Otjid: 'SM01140077', ZzRelationshipKey: 'AZID' }
		];
		expect(getConnections(raw)).toEqual({
			dependencies: [],
			adjacent: [],
			exclusive: ['01130013']
		});
	});
});

describe('empty and malformed SAP prerequisite rows', () => {
	const emptyMarker = {
		LineNumber: '000',
		ModuleId: '00000000',
		Bracket: '',
		Operator: '',
		Peryr: '0000',
		Perid: '000',
		ModuleShort: '',
		ModuleName: ''
	};

	it('recognizes the exact zero-numbered no-prerequisite record', () => {
		const raw = sapPrerequisites([]);
		raw.SmPrereq.results.push(emptyMarker);
		expect(getConnections(raw).dependencies).toEqual([]);
	});

	it('ignores an empty terminal marker after a complete expression', () => {
		const raw = sapPrerequisites([['00460733', '', 'OR'], ['04600734']]);
		raw.SmPrereq.results.push({ ...emptyMarker, LineNumber: '002' });
		expect(getConnections(raw).dependencies).toEqual([
			['00460733'],
			['04600734']
		]);
	});

	it('does not turn an incomplete or labeled row into no requirements', () => {
		const raw = sapPrerequisites([['00460733', '', 'OR']]);
		raw.SmPrereq.results.push(emptyMarker);
		expect(() => getConnections(raw)).toThrow('Expected prerequisite module');
		raw.SmPrereq.results = [{ ...emptyMarker, ModuleName: 'Unknown' }];
		expect(() => getConnections(raw)).toThrow('Empty prerequisite line');
		raw.SmPrereq.results = [
			emptyMarker,
			...sapPrerequisites([['00460733']]).SmPrereq.results
		];
		expect(() => getConnections(raw)).toThrow('Empty prerequisite line');
	});

	const past = { Peryr: '2024', Perid: '201' };
	const current = { PiqYear: '2026', PiqSession: '200' };

	function historicalCourse(id, rows) {
		return {
			Otjid: id,
			...sapPrerequisites(rows),
			SmOfferedPeriodSet: { results: [past] }
		};
	}

	function motionAnalysis() {
		return historicalCourse('SM03360036', [
			['03350010', '('],
			['00000000', ')', 'AND'],
			['03360506', '('],
			['00000000', '', 'AND'],
			['00840506', '('],
			['00000000', '', 'AND'],
			['00360101'],
			['00000000', ')'],
			['00000000', '', 'AND'],
			['00000000', '('],
			['03350010'],
			['00000000', '', 'AND'],
			['03360520'],
			['00000000', ')']
		]);
	}

	it('keeps the published Motion Analysis behavior for the exact historical record', () => {
		expect(
			getConnections(motionAnalysis(), past, current).dependencies
		).toEqual([
			['03350010'],
			['03360506'],
			['00840506', '00360101'],
			['03350010', '03360520']
		]);
	});

	it('keeps the published Algorithms behavior for the exact historical record', () => {
		const [first, second, third] = [
			['02340247', '00940412'],
			['00460002', '01040034'],
			['01040291', '01040034']
		];
		const raw = historicalCourse('SM02360021', [
			['00000000', '('],
			[first[0]],
			['00000000', '', 'AND'],
			[first[1]],
			['00000000', ')'],
			['00000000', '', 'OR'],
			['00000000', '('],
			[second[0]],
			['00000000', '', 'AND'],
			[second[1]],
			['00000000', ')'],
			['00000000', ')'],
			['00000000', '', 'OR'],
			['00000000', '('],
			[third[0]],
			['00000000', '', 'AND'],
			[third[1]],
			['00000000', ')']
		]);
		expect(getConnections(raw, past, current).dependencies).toEqual([
			first,
			second,
			third
		]);
	});

	it('rejects current, changed, and unrecognized malformed input', () => {
		const raw = motionAnalysis();
		expect(() => getConnections(raw, past)).toThrow(
			'Missing closing prerequisite bracket'
		);
		expect(() =>
			getConnections(raw, { ...past, Perid: '200' }, current)
		).toThrow('Missing closing prerequisite bracket');
		raw.SmOfferedPeriodSet.results.push({ Peryr: '2026', Perid: '200' });
		expect(() => getConnections(raw, past, current)).toThrow(
			'Missing closing prerequisite bracket'
		);
		raw.SmOfferedPeriodSet.results.pop();
		raw.SmPrereq.results[1].Operator = 'OR';
		expect(() => getConnections(raw, past, current)).toThrow(
			'Missing closing prerequisite bracket'
		);
	});

	it('uses fixed SAP input instead of the retained rule when a bracket is corrected', () => {
		const raw = motionAnalysis();
		raw.SmPrereq.results.push({ ...raw.SmPrereq.results.at(-1) });
		const [route] = getConnections(raw, past, current).dependencies;
		expect([...new Set(route)]).toEqual([
			'03350010',
			'03360506',
			'00840506',
			'00360101',
			'03360520'
		]);
		expect(getConnections(raw, past, current).dependencies).toHaveLength(1);
	});
});
