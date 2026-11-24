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
