import * as sap from './SAPClient.mjs';

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
