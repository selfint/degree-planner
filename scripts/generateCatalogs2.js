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
 * @returns {Promise<unknown[][] | undefined>} The results of the queries.
 */
async function requestBatch(endpoint, queries, lang = 'en') {
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
			`Accept-Language: ${lang}\r\n\r\n\r\n`
		].join('\r\n');
	}

	const requests = queries.map(buildRequest);
	const body = requests.reduceRight(
		(acc, request) => `--${boundary}\r\n${request}` + acc,
		`--${boundary}--\r\n`
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
		throw new Error(text);
	}

	return blobs.map((blob, index) => {
		const lines = blob.trim().split('\r\n');
		const results = JSON.parse(lines[lines.length - 1]);

		try {
			return results['d']['results'];
		} catch (e) {
			console.error(
				`Request ${index + 1}/${requests.length} in batch failed:\n${requests[index]}\n\n${JSON.stringify(results)}`
			);

			throw e;
		}
	});
}

function formatName(name) {
	return name
		.replace(/_/g, ' ')
		.split(' ')
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * @typedef {Object} Track
 * @property {string} Otjid
 * @property {string} Peryr
 * @property {string} Perid
 * @property {string} Name
 * @property {string} OrgId
 * @property {string} OrgText
 * @property {string} ZzQualifications
 */

/**
 *
 * @param {{ParentOtjid: string, Peryr: string, Perid: string}} trees
 */
async function loadTreeOnDemandSet({ ParentOtjid, Peryr, Perid }) {
	const results = await requestBatch(
		'TreeOnDemandSet',
		[
			{
				'sap-client': '700',
				$filter: `ParentOtjid eq '${ParentOtjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
				$orderby: 'Otjid asc'
			}
		],
		'en'
	);

	const resultsHe = await requestBatch(
		'TreeOnDemandSet',
		[
			{
				'sap-client': '700',
				$filter: `ParentOtjid eq '${ParentOtjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`,
				$orderby: 'Otjid asc'
			}
		],
		'he'
	);

	if (results === undefined || resultsHe === undefined) {
		throw new Error('Failed fetch tree');
	}

	const resultsHeMap = new Map(
		resultsHe[0].map((child) => [child.Otjid, child])
	);

	const trees = results[0].flatMap(async (child) => {
		if (child.Otjid.startsWith('SM')) {
			return child.Otjid;
		}

		const childHe = resultsHeMap.get(child.Otjid);

		if (childHe === undefined) {
			throw new Error(`Failed to find Hebrew name for ${child.Otjid}`);
		}

		let courses = undefined;
		let children = undefined;
		if (child.HasChildren) {
			const childTrees = await loadTreeOnDemandSet({
				ParentOtjid: child.Otjid,
				Peryr: child.Peryr,
				Perid: child.Perid
			});

			courses = childTrees.filter(
				(child) => typeof child === 'string' && child.startsWith('SM')
			);
			children = childTrees.filter(
				(child) => !(typeof child === 'string' && child.startsWith('SM'))
			);

			courses = courses.length > 0 ? courses : undefined;
			children = children.length > 0 ? children : undefined;
		}

		return {
			Otjid: child.Otjid,
			Name: {
				en: child.Stext,
				he: childHe.Stext
			},
			courses,
			children
		};
	});

	return await Promise.all(trees);
}

async function main() {
	console.error('Fetching faculties');

	/** @type {{PiqYear: string, PiqSession: string, ZzOrgId: string, ZzOrgName: string}[]} */
	const faculties = await requestBatch('StudyFieldTilesSet', [
		{
			'sap-client': '700',
			$skip: '0',
			$top: '10000',
			$orderby: 'Prio asc',
			$filter: "PiqYear eq '2024' and PiqSession eq '200'",
			$inlinecount: 'allpages'
		}
	]).then((results) =>
		results[0].map((c) => ({
			PiqYear: c.PiqYear,
			PiqSession: c.PiqSession,
			ZzOrgId: c.ZzOrgId,
			ZzOrgName: c.ZzOrgName
		}))
	);

	console.error(`Got ${faculties.length} faculties`);

	console.error(`Fetching faculty Hebrew names`);
	const facultiesHebrew = await requestBatch(
		'StudyFieldTilesSet',
		faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
			'sap-client': '700',
			$filter: `PiqYear eq '${PiqYear}' and PiqSession eq '${PiqSession}' and ZzOrgId eq '${ZzOrgId}'`,
			$select: 'ZzOrgName,ZzOrgId'
		})),
		'he'
	).then((results) => results.flat());

	for (let i = 0; i < faculties.length; i++) {
		if (faculties[i].ZzOrgId !== facultiesHebrew[i].ZzOrgId) {
			throw new Error(
				`Faculty ID mismatch: ${faculties[i].ZzOrgId} !== ${facultiesHebrew[i].ZzOrgId}`
			);
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
			'sap-client': '700',
			$skip: '0',
			$top: '10000',
			$orderby: 'ZzAcademicLevel asc,Name asc',
			$filter: `Peryr eq '${PiqYear}' and Perid eq '${PiqSession}' and OrgId eq '${ZzOrgId}' and ZzAcademicLevel eq '1'`,
			$inlinecount: 'allpages'
		}))
	);

	const tracks = degrees.flatMap((degreeTracks, index) =>
		degreeTracks.flatMap((track) => ({
			Otjid: track.Otjid,
			Peryr: track.Peryr,
			Perid: track.Perid,
			Name: track.Name,
			OrgId: track.OrgId,
			OrgText: track.OrgText,
			ZzQualifications: track.ZzQualifications
		}))
	);

	console.error(`Got ${degrees.length} degrees, and ${tracks.length} tracks`);

	console.error(`Fetching tracks Hebrew names`);
	const tracksHebrew = await requestBatch(
		'ScObjectSet',
		tracks.map(({ Otjid, Peryr, Perid }) => ({
			'sap-client': '700',
			$filter: `Otjid eq '${Otjid}' and Peryr eq '${Peryr}' and Perid eq '${Perid}'`
		})),
		'he'
	).then((results) => results.flat());

	for (let i = 0; i < tracks.length; i++) {
		if (tracks[i].Otjid !== tracksHebrew[i].Otjid) {
			throw new Error(
				`Track ID mismatch: ${tracks[i].Otjid} !== ${tracksHebrew[i].Otjid}`
			);
		}

		tracks[i].Name = {
			en: tracks[i].Name,
			he: tracksHebrew[i].Name
		};

		tracks[i].OrgText = {
			en: tracks[i].OrgText,
			he: tracksHebrew[i].OrgText
		};

		tracks[i].ZzQualifications = {
			en: tracks[i].ZzQualifications,
			he: tracksHebrew[i].ZzQualifications
		};
	}

	console.error(`Fetching tracks`);

	const trees = await Promise.all(
		tracks.slice(0, 10).map(async (track) => ({
			...track,
			tree: await loadTreeOnDemandSet({
				ParentOtjid: track.Otjid,
				Peryr: track.Peryr,
				Perid: track.Perid
			})
		}))
	);

	return trees;
}

console.log(JSON.stringify(await main(), null, 2));
// console.log(JSON.stringify(await main()));
