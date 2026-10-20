<script lang="ts">
	import type { Component, ComponentProps } from 'svelte';
	import DegreeSection from '../../routes/app/(withCourseData)/settings/components/DegreeSection.svelte';
	import SemesterSection from '../../routes/app/(withCourseData)/settings/components/SemesterSection.svelte';
	import UploadSection from '../../routes/app/(withCourseData)/settings/components/UploadSection.svelte';
	import {
		catalogs,
		getCourseData,
		sampleDegree,
		courses
	} from '../../../.storybook/fixtures';
	import { user } from '../../../.storybook/mocks/stores.svelte';
	let {
		kind = 'DegreeSection',
		state: variant = 'default'
	}: { kind?: string; state?: string } = $props();
	// Fixture boundary uses the documented tuple shape, not the generated catalog-key union.
	const DegreeSelector = DegreeSection as Component<
		Omit<ComponentProps<typeof DegreeSection>, 'userDegree'> & {
			userDegree?: [string, string, string];
		}
	>;
	let buttonNamespace = $state(''),
		message = $state('');
</script>

{#if kind === 'DegreeSection'}
	<DegreeSelector
		userPath={variant === 'selectedPath' ? 'example-path' : undefined}
		{catalogs}
		userDegree={variant === 'unselected'
			? undefined
			: (sampleDegree as unknown as [string, string, string])}
		recommended={variant === 'recommended'
			? [[courses[1].code], [courses[0].code], []]
			: undefined}
		onChange={async (degree, path) => {
			user.d = { ...user.d, degree, path };
			message = 'Demo degree saved';
			return true;
		}}
		onReset={() => (message = 'Demo reset requested')}
		bind:buttonNamespace
	/>
{:else if kind === 'SemesterSection'}
	<SemesterSection
		semesterChoice={variant === 'changed' ? 0 : user.d.currentSemester}
		totalSemestersChoice={variant === 'changed' ? 6 : user.d.semesters.length}
		bind:buttonNamespace
	/>
{:else if kind === 'UploadSection'}
	<UploadSection {getCourseData} bind:buttonNamespace />
{/if}
{#if message}<output>{message}</output>{/if}
