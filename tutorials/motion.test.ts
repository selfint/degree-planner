import { expect, test } from '@playwright/test';
import {
	movePointer,
	revealTarget,
	setPointerPosition
} from './helpers/motion';

for (const direction of ['ltr', 'rtl']) {
	test(`recording scroll has intermediate frames and settles (${direction})`, async ({
		page
	}) => {
		await page.setContent(
			`<main dir="${direction}" style="margin-top:1000px"><div id="panel" style="width:200px;height:200px;overflow:auto"><div style="height:600px"></div><div style="width:1200px"><button id="target" style="margin-inline-start:600px">Target</button></div><div style="height:600px"></div></div></main>`
		);
		await page.evaluate(() => {
			const samples: number[] = [];
			const horizontal: number[] = [];
			Object.assign(window, {
				motionSamples: samples,
				horizontalSamples: horizontal
			});
			document.querySelector('#panel')!.addEventListener('scroll', (event) => {
				samples.push((event.target as HTMLElement).scrollTop);
				horizontal.push((event.target as HTMLElement).scrollLeft);
			});
		});
		const start = Date.now();
		await revealTarget(page.locator('#target'));
		expect(Date.now() - start).toBeGreaterThanOrEqual(1400);
		await expect(page.locator('#target')).toBeInViewport();
		const samples = await page.evaluate(
			() => (window as unknown as { motionSamples: number[] }).motionSamples
		);
		expect(new Set(samples).size).toBeGreaterThan(10);
		const horizontal = await page.evaluate(
			() =>
				(window as unknown as { horizontalSamples: number[] }).horizontalSamples
		);
		expect(new Set(horizontal).size).toBeGreaterThan(10);
		if (direction === 'rtl') expect(horizontal.at(-1)).toBeLessThan(0);
		else expect(horizontal.at(-1)).toBeGreaterThan(0);
		const final = samples.at(-1)!;
		expect(
			samples.filter((value) => value > final * 0.2 && value < final * 0.8)
				.length
		).toBeGreaterThan(5);
		const settled = await page
			.locator('#panel')
			.evaluate((node) => node.scrollTop);
		await page.waitForTimeout(150);
		expect(
			await page.locator('#panel').evaluate((node) => node.scrollTop)
		).toBe(settled);
	});
}

test('recording drag delivers continuous real pressed-pointer movement', async ({
	page
}) => {
	await page.setContent('<div style="height:600px">Pointer motion test</div>');
	await page.mouse.move(50, 50);
	setPointerPosition(page, { x: 50, y: 50 });
	await page.evaluate(() => {
		const moves: { x: number; buttons: number; time: number }[] = [];
		Object.assign(window, { pointerSamples: moves });
		document.addEventListener('pointermove', (event) =>
			moves.push({
				x: event.clientX,
				buttons: event.buttons,
				time: performance.now()
			})
		);
	});
	await page.mouse.down();
	try {
		await movePointer(page, { x: 650, y: 350 }, 1600);
	} finally {
		await page.mouse.up();
	}
	const moves = await page.evaluate(
		() =>
			(
				window as unknown as {
					pointerSamples: { x: number; buttons: number; time: number }[];
				}
			).pointerSamples
	);
	expect(moves.length).toBeGreaterThan(30);
	expect(moves.every((move) => move.buttons === 1)).toBe(true);
	expect(moves.at(-1)!.x).toBe(650);
	expect(moves.at(-1)!.time - moves[0].time).toBeGreaterThan(1400);
	expect(
		moves.filter((move) => move.x > 200 && move.x < 500).length
	).toBeGreaterThan(10);
});

test('native HTML drag keeps the visible recording pointer moving', async ({
	page
}) => {
	await page.setContent(
		'<div id="source" draggable="true" style="position:absolute;left:50px;top:50px;width:80px;height:80px">Drag</div><div id="drop" style="position:absolute;left:500px;top:250px;width:200px;height:200px">Drop</div><span data-recording-pointer style="position:fixed;pointer-events:none"></span>'
	);
	await page.evaluate(() => {
		const samples: number[] = [];
		Object.assign(window, { nativeDragSamples: samples });
		document
			.querySelector('#source')!
			.addEventListener('dragstart', (event) =>
				(event as DragEvent).dataTransfer!.setData(
					'text/plain',
					'recording-test'
				)
			);
		document.addEventListener('dragover', (event) => {
			event.preventDefault();
			samples.push(event.clientX);
		});
		document.querySelector('#drop')!.addEventListener('drop', (event) => {
			event.preventDefault();
			(event.currentTarget as HTMLElement).dataset.dropped = 'true';
		});
	});
	await page.mouse.move(90, 90);
	setPointerPosition(page, { x: 90, y: 90 });
	await page.mouse.down();
	try {
		await movePointer(page, { x: 600, y: 350 }, 1600);
		await page.mouse.move(600, 350);
	} finally {
		await page.mouse.up();
	}
	await expect(page.locator('#drop')).toHaveAttribute('data-dropped', 'true');
	await expect(page.locator('[data-recording-pointer]')).toHaveCSS(
		'left',
		'600px'
	);
	await expect(page.locator('[data-recording-pointer]')).toHaveCSS(
		'top',
		'350px'
	);
	const samples = await page.evaluate(
		() =>
			(window as unknown as { nativeDragSamples: number[] }).nativeDragSamples
	);
	expect(new Set(samples).size).toBeGreaterThan(10);
});
