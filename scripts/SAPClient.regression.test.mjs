import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as sap from './SAPClient.mjs';
import { requestBatch, validateCollection } from './SAPTransport.mjs';
import {
	course,
	degrees,
	faculties,
	multipart,
	part,
	sapError,
	semesters
} from './fixtures/sap/responses.mjs';

const options = { retryDelayMs: 0 };
const query = { $filter: "Peryr eq '2024' and Perid eq '200'" };
let fetchMock;
function batches(...parts) {
	for (const response of parts)
		fetchMock.mockImplementationOnce(() =>
			Promise.resolve(multipart(response))
		);
}
async function failure(promise) {
	const result = promise.catch((error) => error);
	await vi.runAllTimersAsync();
	const error = await result;
	expect(error).toBeInstanceOf(Error);
	return error;
}
beforeEach(() => {
	vi.useFakeTimers();
	fetchMock = vi.fn(() => {
		throw new Error('Unexpected network request');
	});
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('SAP batch contract and retry budget (offline)', () => {
	test('accepts quoted boundaries, pretty JSON, and valid empty collections', async () => {
		fetchMock.mockResolvedValue(
			multipart([part([])], { quoted: true, pretty: true })
		);
		expect(await requestBatch('ExampleSet', [query])).toEqual([[]]);
	});
	test('retries only failed subrequests and retains original result slots', async () => {
		batches([part([{ id: 'first' }]), sapError()], [part([{ id: 'second' }])]);
		expect(
			await requestBatch(
				'ExampleSet',
				[query, { $filter: "Peryr eq '2025'" }],
				'he',
				options
			)
		).toEqual([[{ id: 'first' }], [{ id: 'second' }]]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1][1].body).not.toContain('2024');
		expect(fetchMock.mock.calls[1][1].body).toContain('2025');
	});
	test('bounds explicit SAP errors and reports query/language/code without server body', async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(multipart([sapError('CX_SHM_NO_ACTIVE_VERSION')]))
		);
		const error = await failure(
			requestBatch('TreeOnDemandSet', [query], 'he', options)
		);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(error.message).toContain('TreeOnDemandSet language=he');
		expect(error.message).toContain("Peryr eq '2024'");
		expect(error.message).toContain('CX_SHM_NO_ACTIVE_VERSION');
		expect(error.message).not.toContain('Internal diagnostics');
	});
	test.each([
		['missing d', { payload: {} }],
		['missing results', { payload: { d: {} } }],
		['non-array results', { payload: { d: { results: {} } } }],
		['continuation', part([], { __next: 'next-page' })],
		['count mismatch', part([], { __count: '2' })],
		['invalid count', part([], { __count: 'unknown' })],
		['inner error with outer success', sapError()]
	])('rejects and retries %s', async (_, response) => {
		fetchMock.mockImplementation(() => Promise.resolve(multipart([response])));
		await failure(requestBatch('ExampleSet', [query], 'en', options));
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
	test.each([
		['missing part', () => multipart([])],
		['missing boundary', () => new Response('bad')],
		[
			'outer HTTP failure',
			() => new Response('secret error body', { status: 503 })
		],
		[
			'truncated multipart',
			() =>
				new Response('--x\r\n', {
					headers: { 'Content-Type': 'multipart/mixed; boundary=x' }
				})
		]
	])('rejects %s', async (_, response) => {
		fetchMock.mockImplementation(() => Promise.resolve(response()));
		await failure(requestBatch('ExampleSet', [query], 'en', { maxRetry: 0 }));
	});
	test('recovers after malformed/empty required response', async () => {
		batches([part([])], [part([{ id: 'restored' }])]);
		const result = await requestBatch('ExampleSet', [query], 'en', {
			...options,
			validate(rows) {
				if (rows.length !== 1) throw new Error('Expected one record');
			}
		});
		expect(result[0][0].id).toBe('restored');
	});
	test('aborts a hung fetch and stops at the total chunk deadline', async () => {
		fetchMock.mockImplementation(() => new Promise(() => {}));
		const start = Date.now();
		const error = await failure(
			requestBatch('ExampleSet', [query], 'he', {
				maxRetry: 10,
				timeoutMs: 20,
				deadlineMs: 45,
				retryDelayMs: 5
			})
		);
		expect(Date.now() - start).toBeLessThanOrEqual(45);
		expect(fetchMock.mock.calls.every(([, args]) => args.signal.aborted)).toBe(
			true
		);
		expect(error.message).toContain('45ms retry budget');
	});
	test('also aborts a stalled response body', async () => {
		const response = {
			ok: true,
			headers: new Headers({ 'Content-Type': 'multipart/mixed; boundary=x' }),
			text: () => new Promise(() => {})
		};
		fetchMock.mockResolvedValue(response);
		await failure(
			requestBatch('ExampleSet', [query], 'en', { timeoutMs: 10, maxRetry: 0 })
		);
		expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
	});
	test('empty input makes no network calls and invalid options fail early', async () => {
		expect(await requestBatch('ExampleSet', [])).toEqual([]);
		await expect(
			requestBatch('ExampleSet', [query], 'en', { maxBatchSize: 0 })
		).rejects.toThrow('maxBatchSize');
		expect(fetchMock).not.toHaveBeenCalled();
	});
	test('chunks queries without losing their validation indices', async () => {
		batches([part([]), part([])], [part([])]);
		const validate = vi.fn();
		expect(
			await requestBatch('ExampleSet', [query, query, query], 'en', {
				maxBatchSize: 2,
				validate
			})
		).toEqual([[], [], []]);
		expect(validate.mock.calls.map((call) => call[1])).toEqual([0, 1, 2]);
	});
	test('honors explicit top-limited lookups but rejects incomplete full datasets', () => {
		const collection = { results: [{}, {}], __count: '10', __next: 'next' };
		expect(validateCollection(collection, { $top: '2' }, true)).toHaveLength(2);
		expect(() => validateCollection(collection, { $top: '2' })).toThrow(
			'Incomplete page'
		);
		expect(validateCollection({ results: [], __count: '0' })).toEqual([]);
	});
});

describe('query-scoped bilingual and required data (offline)', () => {
	test('matches the same faculty ID to the correct year, not the first translation', async () => {
		batches(
			faculties.map((row) => part([row])),
			faculties.map((row) =>
				part([{ ...row, ZzOrgName: `עברית ${row.PiqYear}` }])
			)
		);
		const result = await sap.getFaculties(semesters);
		expect(result.map((row) => row.Name.he)).toEqual([
			'עברית 2024',
			'עברית 2025'
		]);
	});
	test('missing Hebrew faculty retries only that query and recovers', async () => {
		batches(
			faculties.map((row) => part([row])),
			[part([faculties[0]]), part([])],
			[part([{ ...faculties[1], ZzOrgName: 'Recovered' }])]
		);
		const result = sap.getFaculties(semesters);
		await vi.runAllTimersAsync();
		expect((await result)[1].Name.he).toBe('Recovered');
		expect(fetchMock.mock.calls[2][1].body).not.toContain('2024');
	});
	test('persistent missing Hebrew faculty is contextual failure, never TypeError/fallback', async () => {
		batches([part([faculties[0]])], [part([])], [part([])], [part([])]);
		const error = await failure(sap.getFaculties([semesters[0]]));
		expect(error.name).toBe('SAPRequestError');
		expect(error.message).toContain('StudyFieldTilesSet language=he');
		expect(error.message).toContain('00000213');
		expect(error.message).toContain('Incomplete bilingual faculties');
	});
	test('rejects wrong-semester translation even when its ID matches', async () => {
		batches(
			[part([faculties[1]])],
			[part([faculties[0]])],
			[part([faculties[0]])],
			[part([faculties[0]])]
		);
		expect((await failure(sap.getFaculties([semesters[1]]))).message).toContain(
			'Expected PiqYear=2025'
		);
	});
	test('allows a genuinely empty faculty/degree dataset', async () => {
		batches(
			[part([], { __count: '0' })],
			[part([], { __count: '0' })],
			[part([], { __count: '0' })]
		);
		expect(await sap.getFaculties([semesters[0]])).toEqual([]);
		expect(await sap.getDegrees([faculties[0]])).toEqual([[]]);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
	test('keeps degree translations scoped to year and faculty', async () => {
		batches(
			degrees.map((row) => part([row])),
			degrees.map((row) => part([{ ...row, Name: `עברית ${row.Peryr}` }]))
		);
		const result = await sap.getDegrees(faculties);
		expect(result.map(([row]) => row.Name.he)).toEqual([
			'עברית 2024',
			'עברית 2025'
		]);
	});
	test('rejects missing degree translation', async () => {
		batches([part([degrees[0]])], [part([])], [part([])], [part([])]);
		expect((await failure(sap.getDegrees([faculties[0]]))).message).toContain(
			'ScObjectSet language=he'
		);
	});
	test('matches identical group IDs within each parent/year query', async () => {
		const groups = degrees.map((row) => ({
			Otjid: 'CG001',
			Peryr: row.Peryr,
			Perid: row.Perid,
			ParentOtjid: row.Otjid,
			Stext: `Group ${row.Peryr}`
		}));
		batches(
			groups.map((row) => part([row])),
			groups.map((row) => part([{ ...row, Stext: `עברית ${row.Peryr}` }])),
			[part([]), part([])],
			[part([]), part([])]
		);
		const trees = await sap.getTrackTrees(degrees);
		expect(trees.map((tree) => tree.children[0].Name.he)).toEqual([
			'עברית 2024',
			'עברית 2025'
		]);
	});
	test('rejects bilingual child ID mismatch and permits genuinely empty tree leaves', async () => {
		const group = {
			Otjid: 'CG001',
			Peryr: '2024',
			Perid: '200',
			ParentOtjid: degrees[0].Otjid,
			Stext: 'Group'
		};
		batches([part([group])], [part([])], [part([])], [part([])]);
		expect((await failure(sap.getTrackTrees([degrees[0]]))).message).toContain(
			'Incomplete bilingual tree'
		);
		batches([part([])], [part([])]);
		expect(await sap.getTrackTrees([degrees[0]])).toEqual([
			{ courses: undefined, children: undefined }
		]);
	});
	test('rejects empty required semester root', async () => {
		batches([part([])], [part([])], [part([])]);
		expect((await failure(sap.getSemesterYears())).message).toContain(
			'Missing required academic semesters'
		);
	});
	test.each(['Exams', 'SmRelations', 'SmPrereq', 'SmOfferedPeriodSet'])(
		'requires expanded %s, but accepts its empty results',
		async (field) => {
			batches([part([{ ...course, [field]: undefined }])], [part([course])]);
			const result = sap.getCourseData([course]);
			await vi.runAllTimersAsync();
			expect((await result)[0][0][field]).toEqual({ results: [] });
		}
	);
	test('does not silently drop a requested course with an empty detail response', async () => {
		batches([part([])], [part([])], [part([])]);
		expect((await failure(sap.getCourseData([course]))).message).toContain(
			'exactly one matching record'
		);
	});
});

test('preserves SAP batch GET framing and the public course detail shape', async () => {
	batches([part([course])]);
	const [[result]] = await sap.getCourseData([course]);
	expect(result).not.toHaveProperty('Peryr');
	expect(result).not.toHaveProperty('Perid');
	expect(result.Name).toBe(course.Name);
	expect(fetchMock.mock.calls[0][1].body).toContain(
		'Accept: application/json\r\n\r\n\r\n\r\n--batch_degree_planner--'
	);
});

test('rejects invalid JSON inside a successful outer response', async () => {
	fetchMock.mockImplementation(() =>
		Promise.resolve(
			new Response(
				'--x\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\ninvalid json\r\n--x--\r\n',
				{ headers: { 'Content-Type': 'multipart/mixed; boundary=x' } }
			)
		)
	);
	expect(
		(await failure(requestBatch('ExampleSet', [query], 'en', options))).message
	).toContain('Invalid JSON');
});

test('rejects an OData error even when the inner status is 200', async () => {
	fetchMock.mockImplementation(() =>
		Promise.resolve(multipart([{ ...sapError(), status: 200 }]))
	);
	expect(
		(await failure(requestBatch('ExampleSet', [query], 'en', options))).message
	).toContain('RFC_FAILURE');
});

test('rejects duplicate identities instead of silently using one', async () => {
	const duplicate = [faculties[0], faculties[0]];
	batches([part(duplicate)], [part(duplicate)], [part(duplicate)]);
	expect((await failure(sap.getFaculties([semesters[0]]))).message).toContain(
		'duplicate identity'
	);
});

test('rejects a tree cycle before recursing indefinitely', async () => {
	const self = {
		Otjid: degrees[0].Otjid,
		ParentOtjid: degrees[0].Otjid,
		Peryr: '2024',
		Perid: '200',
		Stext: 'Self'
	};
	batches([part([self])], [part([self])]);
	await expect(sap.getTrackTrees([degrees[0]])).rejects.toThrow(
		'Cyclic SAP tree'
	);
});

test('fetches bilingual faculty collections once per semester, matching reordered IDs', async () => {
	const first = faculties[0];
	const second = { ...first, ZzOrgId: '00002020', ZzOrgName: 'Second' };
	batches(
		[part([first, second])],
		[
			part([
				{ ...second, ZzOrgName: 'שני' },
				{ ...first, ZzOrgName: 'ראשון' }
			])
		]
	);
	const result = await sap.getFaculties([semesters[0]]);
	expect(result.map((row) => row.Name.he)).toEqual(['ראשון', 'שני']);
	expect(fetchMock).toHaveBeenCalledTimes(2);
	expect(fetchMock.mock.calls[1][1].body).not.toContain('ZzOrgId+eq');
});

test('never blesses empty English after Hebrew has proved that collection incomplete', async () => {
	batches([part([])], [part([faculties[0]])], [part([])], [part([])]);
	expect((await failure(sap.getFaculties([semesters[0]]))).message).toContain(
		'Incomplete English faculty collection'
	);
});

test.each(['faculties', 'degrees', 'trees'])(
	'retries a disappeared previously populated %s scope',
	async (kind) => {
		batches([part([])], [part([])], [part([])]);
		const operation =
			kind === 'faculties'
				? sap.getFaculties([semesters[0]], new Set(['2024/200']))
				: kind === 'degrees'
					? sap.getDegrees([faculties[0]], new Set(['2024/200/00000213']))
					: sap.getTrackTrees([degrees[0]], new Set(['2024/200/SC000001']));
		expect((await failure(operation)).message).toContain(
			'Previously populated scope'
		);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	}
);

test('recovers a transient empty faculty collection against the scoped baseline', async () => {
	batches([part([])], [part([faculties[0]])], [part([faculties[0]])]);
	const operation = sap.getFaculties([semesters[0]], new Set(['2024/200']));
	await vi.runAllTimersAsync();
	expect(await operation).toHaveLength(1);
});

test('matches reordered Hebrew siblings by ID and keeps empty leaves', async () => {
	const group = {
		Otjid: 'CG001',
		Peryr: '2024',
		Perid: '200',
		ParentOtjid: 'SC000001',
		Stext: 'One'
	};
	const other = { ...group, Otjid: 'CG002', Stext: 'Two' };
	batches(
		[part([group, other])],
		[
			part([
				{ ...other, Stext: 'שני' },
				{ ...group, Stext: 'ראשון' }
			])
		],
		[part([]), part([])],
		[part([]), part([])]
	);
	const [tree] = await sap.getTrackTrees([degrees[0]]);
	expect(tree.children.map((row) => row.Name.he)).toEqual(['ראשון', 'שני']);
});

test('rejects children returned for the wrong parent', async () => {
	const group = {
		Otjid: 'CG001',
		Peryr: '2024',
		Perid: '200',
		ParentOtjid: 'OTHER',
		Stext: 'One'
	};
	batches([part([group])], [part([group])], [part([group])]);
	expect((await failure(sap.getTrackTrees([degrees[0]]))).message).toContain(
		'Expected ParentOtjid=SC000001'
	);
});

test.each([{ __next: 'next' }, { __count: '2' }])(
	'rejects an incomplete expanded course collection %j',
	async (metadata) => {
		const incomplete = { ...course, Exams: { results: [], ...metadata } };
		batches([part([incomplete])], [part([incomplete])], [part([incomplete])]);
		expect((await failure(sap.getCourseData([course]))).message).toContain(
			'Incomplete Exams'
		);
	}
);

test('never blesses an empty nested English tree after Hebrew proves children exist', async () => {
	const group = {
		Otjid: 'CG001',
		Peryr: '2024',
		Perid: '200',
		ParentOtjid: 'SC000001',
		Stext: 'Group'
	};
	const child = {
		...group,
		Otjid: 'SM000001',
		ParentOtjid: 'CG001',
		Stext: 'Course'
	};
	batches(
		[part([group])],
		[part([group])],
		[part([])],
		[part([child])],
		[part([])],
		[part([])]
	);
	expect(
		(
			await failure(
				sap.getTrackTrees([degrees[0]], new Set(['2024/200/SC000001']))
			)
		).message
	).toContain('Incomplete English tree collection');
});
