import { expect, type Locator, type Page } from '@playwright/test';

type Point = { x: number; y: number };
const positions = new WeakMap<Page, Point>();
export const ease = (progress: number) =>
	progress * progress * (3 - 2 * progress);

export function setPointerPosition(page: Page, point: Point) {
	positions.set(page, point);
}

// Playwright's steps alone have no duration guarantee. Separate real mouse events
// with elapsed time so the browser recorder can capture the complete movement.
export async function movePointer(page: Page, to: Point, durationMs = 900) {
	const from = positions.get(page);
	if (!from) throw new Error('Register the recording pointer before moving it');
	const steps = Math.max(2, Math.ceil(durationMs / 25));
	for (let step = 1; step <= steps; step++) {
		await page.waitForTimeout(durationMs / steps);
		const progress = ease(step / steps);
		const point = {
			x: from.x + (to.x - from.x) * progress,
			y: from.y + (to.y - from.y) * progress
		};
		await page.mouse.move(point.x, point.y);
		// Native HTML drag suppresses mousemove. Keep only the decorative
		// recording cursor aligned with the real pointer during that gesture.
		await page.evaluate(({ x, y }) => {
			const cursor = document.querySelector<HTMLElement>(
				'[data-recording-pointer]'
			);
			if (cursor) {
				cursor.style.left = `${x}px`;
				cursor.style.top = `${y}px`;
			}
		}, point);
		positions.set(page, point);
	}
}

export async function approachTarget(page: Page, target: Locator) {
	await expect(target).toBeVisible();
	const box = await target.boundingBox();
	if (!box) throw new Error('Recording target has no bounding box');
	await movePointer(page, {
		x: box.x + box.width / 2,
		y: box.y + box.height / 2
	});
}

// Animate the real scroll offsets, including nested panels. Do not call instant
// scrollIntoView even to measure an endpoint: that would leak a jump into video.
export async function revealTarget(target: Locator) {
	await expect(target).toBeVisible();
	await target.evaluate(async (node) => {
		const wait = (ms: number) =>
			new Promise<void>((resolve) => setTimeout(resolve, ms));
		const frame = () =>
			new Promise<number>((resolve) => requestAnimationFrame(resolve));
		const root = document.scrollingElement as HTMLElement;
		const ancestors: HTMLElement[] = [];
		for (
			let parent = node.parentElement;
			parent;
			parent = parent.parentElement
		) {
			const style = getComputedStyle(parent);
			if (
				parent !== root &&
				/(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY)
			)
				ancestors.push(parent);
		}
		ancestors.push(root);
		for (const scroller of ancestors) {
			const rect = node.getBoundingClientRect();
			const bounds =
				scroller === root
					? {
							left: 0,
							top: 0,
							right: innerWidth,
							bottom: innerHeight,
							width: innerWidth,
							height: innerHeight
						}
					: scroller.getBoundingClientRect();
			const dx =
				rect.left >= bounds.left && rect.right <= bounds.right
					? 0
					: rect.left + rect.width / 2 - (bounds.left + bounds.width / 2);
			const dy =
				rect.top >= bounds.top && rect.bottom <= bounds.bottom
					? 0
					: rect.top + rect.height / 2 - (bounds.top + bounds.height / 2);
			const start = { x: scroller.scrollLeft, y: scroller.scrollTop };
			// Browser clamping handles RTL scrollLeft's negative range naturally.
			const end = {
				x: start.x + dx,
				y: Math.max(
					0,
					Math.min(scroller.scrollHeight - scroller.clientHeight, start.y + dy)
				)
			};
			if (Math.abs(dx) < 1 && Math.abs(end.y - start.y) < 1) continue;
			await wait(300);
			const began = await frame();
			let progress = 0;
			do {
				progress = Math.min(1, ((await frame()) - began) / 900);
				const eased = progress * progress * (3 - 2 * progress);
				scroller.scrollTo({
					left: start.x + (end.x - start.x) * eased,
					top: start.y + (end.y - start.y) * eased,
					behavior: 'instant'
				});
			} while (progress < 1);
			// Require actual scroll offsets to settle across consecutive animation
			// frames; fail rather than hiding a continuously moving layout.
			let stable = 0;
			let previous = { x: scroller.scrollLeft, y: scroller.scrollTop };
			for (let frames = 0; frames < 120 && stable < 5; frames++) {
				await frame();
				const current = { x: scroller.scrollLeft, y: scroller.scrollTop };
				stable =
					Math.abs(current.x - previous.x) < 0.5 &&
					Math.abs(current.y - previous.y) < 0.5
						? stable + 1
						: 0;
				previous = current;
			}
			if (stable < 5) throw new Error('Recording scroll did not settle');
			await wait(300);
		}
	});
	await expect(target).toBeInViewport();
}
