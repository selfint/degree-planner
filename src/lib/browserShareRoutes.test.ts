import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	browserShareDestination,
	consolePathname,
	navigateFromBrowserShare
} from './browserShareRoutes';
import { shouldShowConsoleEntry } from './consoleNavigation';
import { reroute } from '../hooks';

const sharePath = '/share/2024_200/00002120/SC00001320_CG00006382';
const previewPath = '/app/preview/2024_200/00002120/SC00001320_CG00006382';
afterEach(() => vi.unstubAllGlobals());

describe('browser share preview route', () => {
	it('reuses the preview route without changing the out-of-scope URL or plan data', async () => {
		const url = new URL(
			`${sharePath}?path=CG00006253&semesters=02340124%7E%7E#plan`,
			'https://example.test'
		);
		const original = url.href;
		expect(await reroute({ url, fetch })).toBe(previewPath);
		expect(url.href).toBe(original);
		expect(url.searchParams.get('semesters')).toBe('02340124~~');
		const manifest = JSON.parse(
			readFileSync('static/manifest.webmanifest', 'utf8')
		);
		expect(manifest.scope).toBe('/app/');
		expect(url.pathname.startsWith(manifest.scope)).toBe(false);
	});
	it('allows the same trailing-slash behavior as the existing preview', () => {
		expect(browserShareDestination(`${sharePath}/`)).toBe(`${previewPath}/`);
	});
	it.each([
		'/',
		'/app/plan',
		previewPath,
		'/preview/2024_200/00002120/SC00001320_CG00006382',
		'/share',
		'/share/a/b',
		'/share/a/b/c/extra',
		'/share/a/b/%2F',
		'/share//b/c'
	])('leaves other routes unchanged: %s', (path) => {
		expect(browserShareDestination(path)).toBeUndefined();
		expect(consolePathname(path)).toBe(path);
	});
	it('retains the console shell and account gate without a second startup on import', () => {
		expect(consolePathname(sharePath)).toBe(previewPath);
		expect(shouldShowConsoleEntry(sharePath, '/app/plan')).toBe(false);
		expect(shouldShowConsoleEntry('/', sharePath)).toBe(true);
	});
});

describe('entering the controlled app from a browser preview', () => {
	it.each([
		'/app/plan',
		'/app/settings',
		'/app/search?q=course',
		'/app/course/02340124'
	])('loads a new document for %s', async (destination) => {
		const current = new URL(sharePath, 'https://example.test');
		const assign = vi.fn();
		vi.stubGlobal('window', {
			location: {
				href: current.href,
				pathname: current.pathname,
				origin: current.origin,
				assign
			}
		});
		const navigate = vi.fn(async () => {});
		await navigateFromBrowserShare(destination, navigate);
		expect(assign).toHaveBeenCalledWith(new URL(destination, current).href);
		expect(navigate).not.toHaveBeenCalled();
	});
	it.each([
		['/app/plan', '/app/search?q=course'],
		[sharePath, '/'],
		[sharePath, 'https://other.example/app/plan']
	])(
		'retains the normal navigator from %s to %s',
		async (currentPath, destination) => {
			const current = new URL(currentPath, 'https://example.test');
			const assign = vi.fn();
			vi.stubGlobal('window', {
				location: {
					href: current.href,
					pathname: current.pathname,
					origin: current.origin,
					assign
				}
			});
			const navigate = vi.fn(async () => {});
			await navigateFromBrowserShare(destination, navigate);
			expect(assign).not.toHaveBeenCalled();
			expect(navigate).toHaveBeenCalledWith(destination);
		}
	);
});

describe('pre-hydration browser preview loader', () => {
	const html = readFileSync('src/app.html', 'utf8');
	const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(
		(match) => match[1].includes('location.pathname')
	)![1];
	it.each([
		sharePath,
		`${sharePath}/`,
		'/app/plan',
		'/',
		'/share/a/b',
		'/share/a/b/c/extra'
	])('matches the routed shell only: %s', (pathname) => {
		const elements = new Map<string, Record<string, unknown>>();
		const get = (id: string) => {
			if (!elements.has(id))
				elements.set(id, { hidden: true, style: { display: 'none' } });
			return elements.get(id)!;
		};
		runInNewContext(script, {
			location: { pathname },
			document: { getElementById: get },
			localStorage: { getItem: () => 'en' }
		});
		const isShell =
			pathname.startsWith('/app/') ||
			browserShareDestination(pathname) !== undefined;
		expect(get('console-boot').hidden).toBe(!isShell);
	});
});
