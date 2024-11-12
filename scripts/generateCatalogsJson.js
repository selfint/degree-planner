/// <reference path="./types.d.ts"/>

/**
 * @param {number} bytes
 * @param {number} decimals
 * @returns
 */
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Request a batch of queries to the Technion SAP API.
 * @param {unknown[]} endpoint
 * @param {unknown[]} queries
 * @returns {Promise<unknown[][]>} The results of the queries.
 */
async function requestBatch(endpoint, queries, lang = 'en', maxRetry = 7) {
	// break the queries into batches if needed
	const maxBatchSize = 500;
	const responses = [];

	if (queries.length > maxBatchSize) {
		console.error(
			`Requesting ${queries.length} queries in ${Math.ceil(queries.length / maxBatchSize)} batches`
		);
	}

	for (let i = 0; i < queries.length; i += maxBatchSize) {
		const batch = queries.slice(i, i + maxBatchSize);
		let response = await requestSAP(endpoint, batch, lang);
		let retry = 0;
		let timeoutMS = 1000;
		while (response === undefined) {
			retry++;
			if (retry > maxRetry) {
				const msg = `Failed to fetch batch ${i / maxBatchSize + 1}/${queries.length / maxBatchSize}`;
				console.error(msg);
				throw new Error(msg);
			}

			console.error(
				`Retrying request ${i / maxBatchSize + 1}/${queries.length / maxBatchSize} (${retry}/${maxRetry})`
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
 * Request a batch of queries to the Technion SAP API.
 * @param {unknown[]} endpoint
 * @param {unknown[]} queries
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

	console.error(
		`Sending request to '${endpoint}', batch size: ${queries.length}`
	);

	/** @type {Response} */
	let response;
	try {
		response = await fetch(url, { method: 'POST', headers, body });
	} catch (error) {
		console.error(error);
		return undefined;
	}

	const contentLength = response.headers.get('Content-Length');
	const size = formatBytes(parseInt(contentLength, 10));

	console.error(`Got response: status=${response.status} size=${size}`);

	if (!response.ok) {
		console.error(await response.text());
		return undefined;
	}

	const text = await response.text();
	const responseBoundary = response.headers
		.get('Content-Type')
		.split('boundary=')[1];

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
 *
 * @param {{Otjid: string, Peryr: string, Perid: string}[]} batch
 * @returns {Promise<{courses: string, children: Tree[]}[]>}
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
	/** @type {{courses: string[], children: Tree[]}[]} */
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

		let courses = batchCourses[i];
		courses = courses.length > 0 ? courses : undefined;

		/** @type {Tree[]} */
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

async function main() {
	console.error('Fetching semesters');
	const semesters = await requestBatch('SemesterSet', [
		{
			$skip: '0',
			$top: '10000',
			$select: 'PiqYear,PiqSession'
		}
	]).then((response) =>
		[
			...new Set(
				response
					.flat()
					.filter(({ PiqSession }) =>
						['200', '201', '202'].includes(PiqSession)
					)
					.map(({ PiqYear, PiqSession }) => `${PiqYear}/${PiqSession}`)
			)
		].map((s) => s.split('/'))
	);

	console.error(`Got ${semesters.length} semesters`);

	console.error('Fetching faculties');

	/** @type {{PiqYear: string, PiqSession: string, ZzOrgId: string, ZzOrgName: string}[]} */
	const faculties = await requestBatch(
		'StudyFieldTilesSet',
		semesters.map(([PiqYear, PiqSession]) => ({
			$skip: '0',
			$top: '10000',
			$orderby: 'Prio asc',
			$filter: `PiqYear eq '${PiqYear}' and PiqSession eq '${PiqSession}'`,
			$inlinecount: 'allpages',
			$select: 'ZzOrgId,ZzOrgName,PiqYear,PiqSession'
		}))
	).then((response) => response.flat());

	console.error(`Got ${faculties.length} faculties`);

	console.error(`Fetching faculty Hebrew names`);
	const facultiesHebrew = await requestBatch(
		'StudyFieldTilesSet',
		faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
			$filter: `PiqYear eq '${PiqYear}' and PiqSession eq '${PiqSession}' and ZzOrgId eq '${ZzOrgId}'`,
			$select: 'ZzOrgName,ZzOrgId'
		})),
		'he'
	).then((response) => response.flat());

	const facultiesHebrewMap = new Map(
		facultiesHebrew.map((faculty) => [faculty.ZzOrgId, faculty.ZzOrgName])
	);

	for (let i = 0; i < faculties.length; i++) {
		const heName = facultiesHebrewMap.get(faculties[i].ZzOrgId);
		if (heName === undefined) {
			throw new Error(`No Hebrew name for faculty ${faculties[i].ZzOrgId}`);
		}

		faculties[i].Name = {
			en: faculties[i].ZzOrgName,
			he: facultiesHebrew[i].ZzOrgName
		};
	}

	console.error(`Fetching degrees`);

	const degrees = await requestBatch(
		'ScObjectSet',
		faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
			$skip: '0',
			$top: '10000',
			$orderby: 'ZzAcademicLevel asc,Name asc',
			$filter: `Peryr eq '${PiqYear}' and Perid eq '${PiqSession}' and OrgId eq '${ZzOrgId}' and ZzAcademicLevel eq '1'`,
			$inlinecount: 'allpages',
			$select: 'Name,Otjid,Peryr,Perid,OrgId,OrgText,ZzQualifications'
		}))
	);

	const tracksInitial = degrees.flat();

	console.error(
		`Got ${degrees.length} degrees, and ${tracksInitial.length} tracks`
	);

	console.error(`Fetching tracks Hebrew names`);
	const tracksHebrew = await requestBatch(
		'ScObjectSet',
		tracksInitial.map(({ Otjid, Peryr, Perid }) => ({
			$filter: `Otjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
			$select: 'Name,OrgText,ZzQualifications,Otjid,Peryr,Perid'
		})),
		'he'
	).then((results) => results.flat());

	for (let i = 0; i < tracksInitial.length; i++) {
		if (tracksInitial[i].Otjid !== tracksHebrew[i].Otjid) {
			throw new Error(
				`Track ID mismatch: ${tracksInitial[i].Otjid} !== ${tracksHebrew[i].Otjid}`
			);
		}

		tracksInitial[i].Name = {
			en: tracksInitial[i].Name,
			he: tracksHebrew[i].Name
		};

		tracksInitial[i].OrgText = {
			en: tracksInitial[i].OrgText,
			he: tracksHebrew[i].OrgText
		};

		tracksInitial[i].ZzQualifications = {
			en: tracksInitial[i].ZzQualifications,
			he: tracksHebrew[i].ZzQualifications
		};
	}

	/** @type {Track[]} */
	const tracks = tracksInitial;
	console.error(`Fetching trees`);

	const trees = await loadChildren(tracks);
	let gotResults = 0;
	for (let i = 0; i < trees.length; i++) {
		const tree = trees[i];
		if (tree.children !== undefined || tree.courses !== undefined) {
			gotResults++;
		}

		// delete __metadata from tracks[i]
		delete tracks[i].__metadata;

		tracks[i].tree = tree;
	}

	console.error(`Got trees for ${gotResults}/${tracks.length} tracks`);

	return tracks;
}

async function temp() {
	const semesters = await requestBatch('SemesterSet', [
		{
			$skip: '0',
			$top: '10000',
			$select: 'PiqYear,PiqSession'
		}
	]).then((response) => response.flat());

	return [
		...new Set(
			semesters.map(({ PiqYear, PiqSession }) => `${PiqYear}/${PiqSession}`)
		)
	].map((s) => s.split('/'));
}

console.log(JSON.stringify(await main(), null, 1));
// console.log(JSON.stringify(await temp(), null, 2));
