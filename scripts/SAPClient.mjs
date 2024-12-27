/// <reference path="./types.d.ts"/>

let totalRequests = 0;
let totalBatches = 0;
let totalBytesSent = 0;
let totalBytesReceived = 0;

/**
 * Get the total usage of the SAP client.
 * @returns {{ requests: number, batches: number, sent: string, received: string }}
 */
export function getUsage() {
	return {
		requests: totalRequests,
		batches: totalBatches,
		sent: formatBytes(totalBytesSent),
		received: formatBytes(totalBytesReceived)
	};
}

/**
 * Request a batch of queries to the Technion SAP API.
 * @param {string} endpoint
 * @param {Record<string, string>[]} queries
 * @returns {Promise<unknown[][] | undefined>} The results of the queries.
 */
async function requestSAP(endpoint, queries, lang = 'en') {
	if (queries.length === 0) {
		return [];
	}

	const url =
		'https://portalex.technion.ac.il/sap/opu/odata/sap/Z_CM_EV_CDIR_DATA_SRV/$batch';

	const boundary = 'batch_1d12-afbf-e3c7';
	const headers = {
		'Accept-Language': lang,
		'User-Agent': '',
		'Content-Type': `multipart/mixed;boundary=${boundary}`
	};

	/**
	 *
	 * @param {Record<string, string>} query
	 * @returns {string}
	 */
	function buildRequest(query) {
		const params = new URLSearchParams(query);

		return [
			'Content-Type: application/http\r\n',
			`GET ${endpoint}?${params} HTTP/1.1`,
			'Accept: application/json',
			'\r\n\r\n\r\n'
		].join('\r\n');
	}

	const requests = queries.map(buildRequest);
	const body = requests.reduceRight(
		(acc, request) => `--${boundary}\r\n${request}` + acc,
		`--${boundary}--\r\n`
	);

	totalBatches += 1;
	totalRequests += queries.length;
	totalBytesSent += body.length;

	console.error(
		`Sending request to '${endpoint}', batch size: ${queries.length}`
	);

	const start = Date.now();

	/** @type {Response} */
	let response;
	try {
		response = await fetch(url, { method: 'POST', headers, body });
	} catch (error) {
		console.error(error);
		return undefined;
	}

	const duration = Date.now() - start;

	const contentLength = response.headers.get('Content-Length');
	const contentSize = parseInt(contentLength ?? '-1', 10);
	totalBytesReceived += contentSize;
	const size = formatBytes(contentSize);

	console.error(
		`Got response: status=${response.status} size=${size} duration=${duration}ms`
	);

	if (!response.ok) {
		console.error(await response.text());
		return undefined;
	}

	const text = await response.text();
	const contentType = response.headers.get('Content-Type');
	if (contentType === null) {
		console.error(`Request failed, no content type: ${url}`);
		return undefined;
	}

	const responseBoundary = contentType.split('boundary=')[1];

	const blobs = text.split(`--${responseBoundary}`).slice(1, -1);

	if (blobs.length !== queries.length) {
		console.error(
			`Expected ${queries.length} blobs, got ${blobs.length}, treating as error`
		);
		return undefined;
	}

	try {
		return blobs.map((blob, index) => {
			const lines = blob.trim().split('\r\n');

			let results;
			try {
				results = JSON.parse(lines[lines.length - 1]);
			} catch (e) {
				const msg = `Request ${index + 1}/${requests.length} in batch failed '${JSON.stringify(e)}':\n${requests[index]}`;
				console.error(msg);
				throw new Error(msg);
			}

			try {
				return results['d']['results'];
			} catch (e) {
				const msg = `Request ${index + 1}/${requests.length} in batch failed '${JSON.stringify(e)}':\n\n---\n${requests[index].trim()}\n\n---\n${JSON.stringify(results, null, 4)}`;
				console.error(msg);

				throw new Error(msg);
			}
		});
	} catch (error) {
		console.error(error);
		return undefined;
	}
}

/**
 * Request a batch of queries to the Technion SAP API.
 * @param {string} endpoint
 * @param {Record<string, string>[]} queries
 * @param {'en' | 'he'} lang
 * @param {{maxRetry?: number, maxBatchSize?: number}} options
 * @returns {Promise<unknown[][]>} The results of the queries.
 */
async function requestBatch(
	endpoint,
	queries,
	lang = 'en',
	options = {
		maxRetry: 7,
		maxBatchSize: 500
	}
) {
	// break the queries into batches if needed
	let { maxRetry, maxBatchSize } = options;
	maxRetry ??= 7;
	maxBatchSize ??= 500;

	const responses = [];

	if (queries.length > maxBatchSize) {
		console.error(
			`Requesting '${endpoint}' with ${queries.length} queries in ${Math.ceil(queries.length / maxBatchSize)} batches`
		);
	}

	for (let i = 0; i < queries.length; i += maxBatchSize) {
		const batch = queries.slice(i, i + maxBatchSize);
		console.error(
			`Requesting batch ${i / maxBatchSize + 1}/${Math.ceil(queries.length / maxBatchSize)}`
		);
		let response = await requestSAP(endpoint, batch, lang);
		let retry = 0;
		let timeoutMS = 1000;
		while (response === undefined) {
			retry++;
			if (retry > maxRetry) {
				const msg = `Failed to fetch batch ${i / maxBatchSize + 1}/${Math.ceil(queries.length / maxBatchSize)}`;
				console.error(msg);
				throw new Error(msg);
			}

			console.error(
				`Retrying request ${i / maxBatchSize + 1}/${Math.ceil(queries.length / maxBatchSize)} (${retry}/${maxRetry})`
			);
			await new Promise((resolve) => setTimeout(resolve, timeoutMS));
			timeoutMS *= 2;

			response = await requestSAP(endpoint, batch, lang);
		}

		responses.push(...response);
	}

	return responses;
}

/**
 * @param {number} bytes
 * @param {number} decimals
 * @returns
 */
export function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 *
 * @param {{Otjid: string, Peryr: string, Perid: string}[]} batch
 * @returns {Promise<TreeHead[]>}
 */
async function loadChildren(batch) {
	if (batch.length === 0) {
		return [];
	}

	/** @type {TreeOnDemandSetResponse[][]} */
	const batchResponses = await requestBatch(
		'TreeOnDemandSet',
		batch.map(({ Otjid, Peryr, Perid }) => ({
			'sap-client': '700',
			$filter: `ParentOtjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
			$orderby: 'Otjid asc',
			$select: 'Stext,Otjid,Peryr,Perid'
		})),
		'en'
	);

	/** @type {TreeOnDemandSetResponse[][]} */
	const batchResponsesHebrew = await requestBatch(
		'TreeOnDemandSet',
		batch.map(({ Otjid, Peryr, Perid }) => ({
			'sap-client': '700',
			$filter: `ParentOtjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
			$orderby: 'Otjid asc',
			$select: 'Stext,Otjid'
		})),
		'he'
	);

	if (batchResponses === undefined) {
		throw new Error('Failed fetch tree');
	}

	const heNames = new Map(
		batchResponsesHebrew.flat().map((tree) => [tree.Otjid, tree.Stext])
	);

	// get responses that are courses
	const batchCourses = batchResponses.map((children) =>
		children
			.filter((child) => child.Otjid.startsWith('SM'))
			.map((child) => child.Otjid)
	);

	// get response responses that are course groups
	const batchGroups = batchResponses.map((children) =>
		children.filter((child) => !child.Otjid.startsWith('SM'))
	);

	// get children trees in a single flat request
	const batchLengths = batchGroups.map((group) => group.length);
	const batchChildrenFlat = await loadChildren(batchGroups.flat());

	// unpack flat children trees into batches
	/** @type {TreeHead[]} */
	const batchResults = [];
	let batchOffset = 0;
	for (let i = 0; i < batchLengths.length; i++) {
		const length = batchLengths[i];
		const group = batchGroups[i];
		const batchSlice = batchChildrenFlat.slice(
			batchOffset,
			batchOffset + length
		);
		batchOffset += length;

		/** @type {string[] | undefined} */
		let courses = batchCourses[i];
		courses = courses.length > 0 ? courses : undefined;

		/** @type {Tree[] | undefined} */
		let children = batchSlice.map(({ courses, children }, index) => {
			const response = group[index];
			const heName = heNames.get(response.Otjid);
			if (heName === undefined) {
				throw new Error(`No Hebrew name for ${response.Otjid}`);
			}

			return {
				Otjid: response.Otjid,
				Name: {
					en: response.Stext,
					he: heName
				},
				courses,
				children
			};
		});

		children = children.length > 0 ? children : undefined;

		batchResults.push({ courses, children });
	}

	return batchResults;
}

/**
 * Get populated semester years in SAP
 * @returns {Promise<SemesterYear[]>}
 */
export async function getSemesterYears() {
	const semesters = await requestBatch('SemesterSet', [
		{
			$skip: '0',
			$top: '10000',
			$select: 'PiqYear,PiqSession,IsCurrent'
		}
	]);

	return semesters
		.flat()
		.map((semester) => {
			// delete __metadata
			delete semester.__metadata;
			return semester;
		})
		.filter((semester) => ['200', '201', '202'].includes(semester.PiqSession));
}

/**
 * @param {SemesterYear[]} semesterYears to get faculties for
 * @returns {Promise<Faculty[]>}
 */
export async function getFaculties(semesterYears) {
	const facultiesSet = 'StudyFieldTilesSet';

	const faculties = await requestBatch(
		facultiesSet,
		semesterYears.map(({ PiqYear, PiqSession }) => ({
			$skip: '0',
			$top: '10000',
			$orderby: 'Prio asc',
			$filter: `PiqYear eq '${PiqYear}' and PiqSession eq '${PiqSession}'`,
			$inlinecount: 'allpages',
			$select: 'ZzOrgId,ZzOrgName,PiqYear,PiqSession'
		}))
	).then((results) =>
		results.flat().map((c) => {
			delete c.__metadata;
			return c;
		})
	);

	const facultiesHebrew = await requestBatch(
		facultiesSet,
		faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
			$filter: `PiqYear eq '${PiqYear}' and PiqSession eq '${PiqSession}' and ZzOrgId eq '${ZzOrgId}'`,
			$select: 'ZzOrgName,ZzOrgId'
		})),
		'he'
	).then((results) => results.flat());

	for (let i = 0; i < faculties.length; i++) {
		const faculty = faculties[i];
		const facultyHebrew = facultiesHebrew.find(
			(f) => f.ZzOrgId === faculty.ZzOrgId
		);

		faculty.Name = {
			en: faculty.ZzOrgName,
			he: facultyHebrew.ZzOrgName
		};
	}

	return faculties;
}

/**
 * @param {Faculty[]} faculties faculties to get degrees for
 * @returns {Promise<Degree[][]>}
 */
export async function getDegrees(faculties) {
	const degrees = await requestBatch(
		'ScObjectSet',
		faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
			'sap-client': '700',
			$skip: '0',
			$top: '10000',
			$orderby: 'ZzAcademicLevel asc,Name asc',
			$filter: `Peryr eq '${PiqYear}' and Perid eq '${PiqSession}' and OrgId eq '${ZzOrgId}' and ZzAcademicLevel eq '1'`,
			$select: 'Name,OrgText,ZzQualifications,Otjid,OrgId,Peryr,Perid',
			$inlinecount: 'allpages'
		}))
	);

	const degreesHebrew = await requestBatch(
		'ScObjectSet',
		degrees.flat().map(({ Otjid, Peryr, Perid }) => ({
			$filter: `Otjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
			$select: 'Name,OrgText,ZzQualifications,Otjid,Peryr,Perid'
		})),
		'he'
	);

	for (let degreeIndex = 0; degreeIndex < degrees.length; degreeIndex++) {
		const degree = degrees[degreeIndex];
		for (let trackIndex = 0; trackIndex < degree.length; trackIndex++) {
			const track = degree[trackIndex];
			const trackHebrew = degreesHebrew
				.flat()
				.find((trackHebrew) => trackHebrew.Otjid === track.Otjid);

			track.Name = {
				en: track.Name,
				he: trackHebrew.Name
			};

			track.OrgText = {
				en: track.OrgText,
				he: trackHebrew.OrgText
			};

			track.ZzQualifications = {
				en: track.ZzQualifications,
				he: trackHebrew.ZzQualifications
			};

			delete track.__metadata;
		}
	}

	return degrees;
}

/**
 * @param {Track[]} tracks tracks to get trees for
 * @returns {Promise<TreeHead[]>}
 */
export async function getTrackTrees(tracks) {
	return await loadChildren(tracks);
}

/**
 *
 * @param {SemesterNumber} semester to get name
 * @returns {I18N} i18n name of semester
 */
export function getSemesterName(semester) {
	const semesterNames = new Map([
		['200', { en: 'Winter', he: 'חורף' }],
		['201', { en: 'Spring', he: 'אביב' }],
		['202', { en: 'Summer', he: 'קיץ' }]
	]);

	return semesterNames.get(semester);
}

/**
 *
 * @param {SemesterYear[]} semesterYears
 * @param {number} top
 * @returns {Promise<CourseHeader[][]>}
 */
export async function getCourses(semesterYears, top = 10000) {
	return await requestBatch(
		'SmObjectSet',
		semesterYears.map(({ PiqYear, PiqSession }) => ({
			$skip: 0,
			$top: top,
			$select: 'Otjid,Peryr,Perid',
			$filter: `Peryr eq '${PiqYear}' and Perid eq '${PiqSession}' `
		}))
	).then((results) =>
		results.map((r) =>
			r.map((c) => {
				delete c.__metadata;
				return c;
			})
		)
	);
}

/**
 * @param {CourseHeader[]} courses
 * @returns {Promise<unknown[][]>}
 */
export async function getCourseData(courses) {
	return await requestBatch(
		'SmObjectSet',
		courses.map(({ Otjid, Peryr, Perid }) => ({
			$expand: 'Exams,SmRelations,SmPrereq',
			$filter: `Otjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
			$select: [
				'Otjid',
				'Name',
				'Points',
				'StudyContentDescription',
				'ZzOfferpattern',
				'Exams',
				'SmPrereq',
				'SmRelations',
				'OrgText'
			].join(',')
		})),
		'he',
		{
			maxBatchSize: 100
		}
	).then((results) =>
		results.map((r) =>
			r.map((c) => {
				delete c.__metadata;
				return c;
			})
		)
	);
}
