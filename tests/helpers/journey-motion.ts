import type { Locator } from '@playwright/test';
import { revealTarget, approachTarget } from '../../tutorials/helpers/motion';

/** Presentation only: normal tests execute precisely the original locator action. */
export async function journeyAction<T>(
	target: Locator,
	action: (target: Locator) => Promise<T>,
	enabled = process.env.RECORD_STUDENT_JOURNEYS === '1'
): Promise<T> {
	if (!enabled) return action(target);
	const page = target.page();
	await revealTarget(target);
	await approachTarget(page, target);
	await page.waitForTimeout(350);
	const result = await action(target);
	await page.waitForTimeout(550);
	return result;
}
