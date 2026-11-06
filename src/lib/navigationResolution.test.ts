import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { withoutBase } from './deploymentPaths';

// Execute the layout's actual navigation callback, rather than a copy, while
// recording the boundary between our base normalization and Kit's resolver.
const component = readFileSync(
	new URL('../routes/app/+layout.svelte', import.meta.url),
	'utf8'
);
const script = component.match(/<script lang="ts">([\s\S]*?)<\/script>/)![1];
const ast = ts.createSourceFile(
	'layout.ts',
	script,
	ts.ScriptTarget.Latest,
	true
);
const declaration = ast.statements
	.filter(ts.isVariableStatement)
	.flatMap((statement) => statement.declarationList.declarations)
	.find((declaration) => declaration.name.getText(ast) === 'searchNavigation')!;
const callback = ts.transpileModule(
	`const navigation = ${declaration.initializer!.getText(ast)};`,
	{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;

describe('layout search navigation resolution', () => {
	it.each(['', '/degree-planner'])(
		'resolves the deployment prefix %j exactly once',
		async (base) => {
			const goto = vi.fn(async () => {});
			const resolve = vi.fn((pathname: string) => `${base}${pathname}`);
			const destination = new URL(
				`https://example.test${base}/app/search?q=linear%20algebra&faculty=math#help[0]`
			);
			const navigate = runInNewContext(`${callback}\nnavigation`, {
				URL,
				page: { url: new URL(`https://example.test${base}/app/catalog`) },
				createSearchNavigation: (
					_getPageUrl: () => URL,
					navigate: (url: URL) => Promise<void>
				) => navigate,
				navigateFromBrowserShare: async (
					url: URL,
					navigate: (url: URL) => Promise<void>
				) => navigate(url),
				withoutBase: (pathname: string) => withoutBase(pathname, base),
				resolve,
				goto
			});

			await navigate(destination);

			expect(resolve).toHaveBeenCalledExactlyOnceWith('/app/search');
			expect(goto).toHaveBeenCalledExactlyOnceWith(
				`${base}/app/search?q=linear%20algebra&faculty=math#help[0]`,
				{ noScroll: true, keepFocus: true }
			);
		}
	);
});
