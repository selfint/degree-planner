import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Exercise the actual production-prerendered document, not source-code strings.
// Run `npm run build` first; a missing output is a setup failure, not feature red.
const html = readFileSync(
	'.svelte-kit/output/prerendered/pages/index.html',
	'utf8'
);

test('the rendered landing page contains the original layout with seven feature players', () => {
	assert.match(html, /class="landing flex/, 'the real landing page rendered');
	assert.doesNotMatch(
		html,
		/data-testid="landing-tutorials"/,
		'the rendered landing page must not add a tutorial section'
	);
	assert.doesNotMatch(html, /data-testid="landing-install-info"/);
	assert.match(
		html,
		/viewBox="0 0 265 141"/,
		'original annotated course illustration'
	);
	assert.match(
		html,
		/sm:min-w-\[300px\] sm:max-w-\[300px\]/,
		'original description column'
	);
	assert.match(html, /mb-6 text-5xl/, 'original hero typography');
	const videos = [...html.matchAll(/<video\b([^>]*?)>([\s\S]*?)<\/video>/g)];
	assert.equal(videos.length, 7, 'seven original feature slots are rendered');
	for (const topic of [
		'plan',
		'catalog',
		'settings',
		'course',
		'semester',
		'share',
		'search'
	]) {
		assert.match(html, new RegExp(`data-testid="feature-${topic}"`));
	}
	for (const [, attributes, body] of videos) {
		assert.match(attributes, /\bcontrols(?:\s|=|$)/);
		assert.match(attributes, /preload="none"/);
		assert.match(attributes, /\bplaysinline(?:\s|=|$)/);
		assert.match(attributes, /aria-label="[^"]+"/);
		assert.match(
			attributes,
			/\bh-auto\b/,
			'intrinsic height must scale with the available width'
		);
		assert.doesNotMatch(attributes, /\b(?:autoplay|loop)(?:\s|=|$)/);
		assert.match(body, /type="video\/mp4"/);
		assert.match(body, /type="video\/webm"/);
		assert.match(body, /<track[^>]+kind="captions"/);
	}
	assert.equal(
		(html.match(/class="tutorial-steps/g) ?? []).length,
		0,
		'no extra tutorial transcripts change the original layout'
	);
});
