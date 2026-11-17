import { describe, expect, test, vi, afterEach } from 'vitest';
import { examDay, selectExamOfferings } from './courseExams.mjs';
import { getTests, generateCourseData } from './generateCourseData.mjs';
import * as sap from './SAPClient.mjs';
import * as histograms from './HistogramsClient.mjs';

const exam = (day, CategoryCode) => ({
	ExamDate: `/Date(${Date.parse(`${day}T00:00:00Z`)})/`,
	CategoryCode
});
const offering = (Peryr, Perid, exams, Otjid = 'SM01140078') => ({
	Otjid,
	Peryr,
	Perid,
	Exams: { results: exams }
});
const summer = offering('2025', '202', [
	exam('2026-10-30', 'FI'),
	exam('2026-11-20', 'FB'),
	exam('2026-10-30', 'FI'),
	exam('2026-11-20', 'FB')
]);
const winter = offering('2026', '200', []);
const now = new Date('2026-11-17T12:00:00Z');
const select = (rows, at = now) =>
	selectExamOfferings(rows, at).get('SM01140078');
afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('exam offering selection', () => {
	test('preserves a summer resit when latest winter has no exams', () => {
		expect(select([summer, winter])).toBe(summer);
		expect(select([winter, summer])).toBe(summer);
		expect(getTests(select([summer, winter]))).toEqual([
			{ year: 2026, monthIndex: 9, day: 30 },
			{ year: 2026, monthIndex: 10, day: 20 }
		]);
	});
	test('does not mix an old A with a new B or select an expired older pair', () => {
		const spring = offering('2025', '201', [
			exam('2026-08-10', 'FI'),
			exam('2026-09-02', 'FB')
		]);
		const future = offering('2026', '200', [
			exam('2027-02-10', 'FI'),
			exam('2027-03-02', 'FB')
		]);
		expect(select([spring, future, summer])).toBe(summer);
		expect(
			select([spring, future, summer], new Date('2026-11-21T00:00:00Z'))
		).toBe(future);
	});
	test('includes today in Israel and falls back to latest offering after expiry', () => {
		expect(select([summer, winter], new Date('2026-11-19T22:30:00Z'))).toBe(
			summer
		);
		expect(select([summer, winter], new Date('2026-11-20T22:30:00Z'))).toBe(
			winter
		);
	});
	test('handles null dates, unknown categories, independent courses, and ties', () => {
		const empty = offering('2026', '200', [
			{ ExamDate: null, CategoryCode: 'FI' },
			exam('2026-11-18', 'OTHER')
		]);
		expect(select([summer, empty])).toBe(summer);
		const tie = offering('2026', '200', summer.Exams.results);
		expect(select([tie, summer])).toBe(tie);
		expect(
			selectExamOfferings([summer, offering('2026', '200', [], 'SMOTHER')], now)
				.size
		).toBe(2);
		expect(selectExamOfferings([], now).size).toBe(0);
	});
	test('decodes date-only values independently of machine timezone', () => {
		expect(examDay(exam('2026-11-20', 'FB'))).toBe('2026-11-20');
		expect(examDay({ ExamDate: null })).toBeUndefined();
		expect(() => examDay({ ExamDate: 'bad' })).toThrow('Invalid SAP exam date');
	});
	test('generator keeps latest metadata while using prior offering exams', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(sap, 'getSemesterYears').mockResolvedValue([
			{ PiqYear: '2026', PiqSession: '200', IsCurrent: 0 }
		]);
		vi.spyOn(sap, 'getCourseExams').mockResolvedValue([[summer, winter]]);
		const headers = vi
			.spyOn(sap, 'getCourses')
			.mockResolvedValue([[summer, winter]]);
		const details = vi.spyOn(sap, 'getCourseData').mockResolvedValue([
			[
				{
					...winter,
					Name: 'Latest course name',
					Points: '3.5',
					OrgText: 'Physics',
					SmPrereq: { results: [] },
					SmRelations: { results: [] },
					SmOfferedPeriodSet: { results: [] }
				}
			]
		]);
		vi.spyOn(histograms, 'getMedian').mockResolvedValue(70);
		const courses = await generateCourseData(10000);
		expect(headers.mock.calls[0][1]).toBe(10000);
		expect(details.mock.calls[0][0]).toEqual([winter]);
		expect(courses['01140078'].name).toBe('Latest course name');
		expect(courses['01140078'].tests[1]).toEqual({
			year: 2026,
			monthIndex: 10,
			day: 20
		});
	});
});
