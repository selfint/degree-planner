import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
function luminance(rgb: number[]) {
	return rgb
		.map((channel) => {
			const value = channel / 255;
			return value <= 0.04045
				? value / 12.92
				: ((value + 0.055) / 1.055) ** 2.4;
		})
		.reduce(
			(sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
			0
		);
}
function contrast(a: number[], b: number[]) {
	const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
	return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [name, selector] of [
	['dark', ':root'],
	['light', ":root[data-theme='light']"]
]) {
	const block = css.slice(css.indexOf(selector)).split('}')[0];
	const token = (name: string) =>
		block
			.match(new RegExp(`--color-${name}: ([\\d ]+);`))![1]
			.split(' ')
			.map(Number);
	describe(`${name} PlanIt design tokens`, () => {
		it('keeps body, secondary text and primary action labels readable', () => {
			expect(
				contrast(token('content-primary'), token('background'))
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(token('content-secondary'), token('background'))
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(token('content-secondary'), token('card-primary'))
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(token('content-on-accent'), token('accent-primary'))
			).toBeGreaterThanOrEqual(4.5);
		});
	});
}
