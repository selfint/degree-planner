// Synthetic, minimal OData fixtures. No live SAP access or snapshot updates.
export const semesters = [
	{ PiqYear: '2024', PiqSession: '200', IsCurrent: -1 },
	{ PiqYear: '2025', PiqSession: '200', IsCurrent: 0 }
];
export const faculties = semesters.map(({ PiqYear, PiqSession }) => ({
	PiqYear,
	PiqSession,
	ZzOrgId: '00000213',
	ZzOrgName: `Science ${PiqYear}`
}));
export const degrees = faculties.map(({ PiqYear, PiqSession, ZzOrgId }) => ({
	Peryr: PiqYear,
	Perid: PiqSession,
	OrgId: ZzOrgId,
	Otjid: 'SC000001',
	Name: `Degree ${PiqYear}`,
	OrgText: `Faculty ${PiqYear}`,
	ZzQualifications: 'BSc'
}));
export const course = {
	Otjid: 'SM000001',
	Peryr: '2025',
	Perid: '200',
	Name: 'Course',
	Points: '3.0',
	OrgText: 'Faculty',
	StudyContentDescription: '',
	ZzOfferpattern: '',
	Exams: { results: [] },
	SmRelations: { results: [] },
	SmPrereq: { results: [] },
	SmOfferedPeriodSet: { results: [] }
};

export function part(rows, extras = {}, status = 200) {
	return { payload: { d: { results: rows, ...extras } }, status };
}

export function sapError(code = 'RFC_FAILURE') {
	return {
		status: 500,
		payload: {
			error: { code, message: 'Internal diagnostics must not be logged' }
		}
	};
}

export function multipart(parts, { quoted = false, pretty = false } = {}) {
	const boundary = 'response_fixture';
	const body =
		parts
			.map(
				({ payload, status = 200 }) =>
					`--${boundary}\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${status} Status\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload, null, pretty ? 2 : 0)}\r\n`
			)
			.join('') + `--${boundary}--\r\n`;
	return new Response(body, {
		headers: {
			'Content-Type': `multipart/mixed; boundary=${quoted ? '"' : ''}${boundary}${quoted ? '"' : ''}`
		}
	});
}
