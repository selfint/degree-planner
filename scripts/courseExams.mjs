// SAP ExamDate is a date-only Edm.DateTime (midnight UTC in its JSON encoding).
// ExamBegTime is a separate local wall-clock time. Never decode the calendar
// date in the build machine's timezone, or mix A/B sittings across offerings.
export function examDay(exam) {
	if (exam.ExamDate === null) return undefined;
	const match = /^\/Date\((-?\d+)\)\/$/.exec(exam.ExamDate);
	if (!match) throw new Error('Invalid SAP exam date');
	const date = new Date(Number(match[1]));
	if (!Number.isFinite(date.getTime()))
		throw new Error('Invalid SAP exam date');
	return date.toISOString().slice(0, 10);
}

function later(a, b) {
	return a.Peryr > b.Peryr || (a.Peryr === b.Peryr && a.Perid > b.Perid);
}

/**
 * The public schema stores one A/B pair. Keep the pair from the offering with
 * the nearest upcoming sitting (including today in Israel). Once its last
 * sitting passes, move to the next offering. If none is upcoming, preserve the
 * latest offering's existing behavior. Metadata is selected independently.
 */
export function selectExamOfferings(offerings, now = new Date()) {
	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jerusalem',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
	const selected = new Map();
	const nextDays = new Map();
	for (const offering of offerings) {
		const days = offering.Exams.results
			.filter((exam) => ['FI', 'FB'].includes(exam.CategoryCode))
			.map(examDay)
			.filter((day) => day !== undefined && day >= today)
			.sort();
		const next = days[0];
		const previous = selected.get(offering.Otjid);
		const previousNext = nextDays.get(offering.Otjid);
		if (
			!previous ||
			(next !== undefined &&
				(previousNext === undefined || next < previousNext)) ||
			(next === previousNext && later(offering, previous))
		) {
			selected.set(offering.Otjid, offering);
			nextDays.set(offering.Otjid, next);
		}
	}
	return selected;
}
