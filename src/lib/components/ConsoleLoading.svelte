<script lang="ts">
	import './console-loading.css';
	import { loadingText, type ConsoleLoadingState } from '$lib/consoleLoading';

	type Props = {
		language?: 'en' | 'he';
		state?: ConsoleLoadingState;
		direction?: 'ltr' | 'rtl';
	};
	const {
		language = 'en',
		direction,
		state = { phase: 'opening' }
	}: Props = $props();
	const hebrew = $derived(language === 'he');
	const status = $derived(loadingText(state, hebrew));
</script>

<section
	class="console-loading"
	dir={direction ?? (hebrew ? 'rtl' : 'ltr')}
	lang={language}
	aria-label={hebrew ? 'טעינת PlanIt' : 'Loading PlanIt'}
>
	<div class="console-loading__content">
		<div class="console-loading__brand" aria-label="PlanIt">
			<img
				class="console-loading__logo"
				src="/brand/planit-logo.webp"
				width="76"
				height="76"
				alt=""
			/>
			<img
				class="console-loading__wordmark"
				src="/brand/planit-wordmark.svg"
				width="144"
				height="49"
				alt="PlanIt"
			/>
		</div>
		<div
			class="console-loading__track"
			class:console-loading__track--measured={state.phase === 'data'}
			class:console-loading__track--error={state.phase === 'error'}
			role={state.phase === 'error' ? undefined : 'progressbar'}
			aria-hidden={state.phase === 'error' ? true : undefined}
			aria-label={state.phase === 'data'
				? hebrew
					? 'טעינת קובצי נתונים'
					: 'Loading data files'
				: status}
			aria-valuemin={state.phase === 'data' ? 0 : undefined}
			aria-valuemax={state.phase === 'data' ? state.total : undefined}
			aria-valuenow={state.phase === 'data' ? state.completed : undefined}
		>
			<span
				class="console-loading__indicator"
				style:inline-size={state.phase === 'data'
					? `${(100 * state.completed) / state.total}%`
					: undefined}
			></span>
		</div>
		<p class="console-loading__status" role="status">{status}</p>
	</div>
</section>
