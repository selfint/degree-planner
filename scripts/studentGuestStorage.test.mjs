import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { initializeGuestStorage } from '../tests/helpers/student-guest-storage';

const origin = 'http://localhost:4173';
const seed = { semesters: [[]], currentSemester: 0 };
const script = `(${initializeGuestStorage.toString()})(${JSON.stringify({ origin, language: 'he', seed })})`;

describe('isolated guest storage initialization', () => {
	it.each(['null', 'https://other.example'])(
		'does not access storage at %s',
		(documentOrigin) => {
			let reads = 0;
			const environment = {
				location: { origin: documentOrigin },
				get localStorage() {
					reads++;
					throw new Error('Access denied');
				}
			};
			expect(() =>
				runInNewContext(script, { window: environment })
			).not.toThrow();
			expect(reads).toBe(0);
		}
	);

	it('seeds the exact origin once and preserves later student changes', () => {
		const values = new Map();
		const environment = {
			location: { origin },
			localStorage: {
				getItem: (key) => values.get(key) ?? null,
				setItem: (key, value) => values.set(key, value)
			}
		};
		runInNewContext(script, { window: environment });
		expect(JSON.parse(values.get('userData'))).toEqual(seed);
		expect(values.get('lang')).toBe('he');
		values.set('userData', 'student changes');
		values.set('lang', 'en');
		runInNewContext(script, { window: environment });
		expect(values.get('userData')).toBe('student changes');
		expect(values.get('lang')).toBe('en');
	});

	it('still surfaces genuine same-origin storage failure', () => {
		expect(() =>
			runInNewContext(script, {
				window: {
					location: { origin },
					get localStorage() {
						throw new Error('Access denied');
					}
				}
			})
		).toThrow('Access denied');
	});
});
