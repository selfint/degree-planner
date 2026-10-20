import { journeySegments } from '../src/lib/journeyMedia.ts';
export function validateJourneyMetadata(
	metadata,
	topic,
	language,
	theme,
	expectedSource
) {
	if (
		metadata.schema !== 1 ||
		metadata.status !== 'passed' ||
		metadata.topic !== topic ||
		metadata.language !== language ||
		metadata.theme !== theme ||
		!/^[0-9a-f]{40}$/.test(metadata.commit) ||
		!/^\d+$/.test(metadata.run) ||
		metadata.testFile !== 'tests/student-journeys.test.ts'
	)
		throw new Error('Unverified journey provenance');
	if (
		!expectedSource ||
		metadata.commit !== expectedSource.commit ||
		metadata.run !== expectedSource.run
	)
		throw new Error(
			'Stale journey recording: capture commit and run must match packaging source'
		);
	const expected = journeySegments[topic];
	if (
		!expected ||
		JSON.stringify(metadata.segments?.map((s) => s.name)) !==
			JSON.stringify(expected)
	)
		throw new Error('Incomplete named journey segments');
	const indexes = new Map();
	for (const s of metadata.segments) {
		if (
			!Number.isInteger(s.page) ||
			s.page < 0 ||
			s.index !== (indexes.get(s.page) ?? 0) ||
			typeof s.title !== 'string' ||
			!s.title.trim()
		)
			throw new Error('Invalid journey segment');
		indexes.set(s.page, s.index + 1);
	}
}
