import type { Meta, StoryObj } from '@storybook/sveltekit';
import { userEvent, waitFor, expect, within } from 'storybook/test';
import Preview from './SettingsSectionsPreview.svelte';
const meta = {
	title: 'Components/UploadSection',
	component: Preview,
	parameters: {
		componentPath:
			'src/routes/app/(withCourseData)/settings/components/UploadSection.svelte'
	},
	args: { kind: 'UploadSection' }
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Offline: Story = { parameters: { planner: { online: false } } };
const upload = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
	await userEvent.upload(
		canvasElement.querySelector('input[type=file]') as HTMLInputElement,
		new File(['fictional transcript fixture'], 'demo.pdf', {
			type: 'application/pdf'
		})
	);
};
export const ParsedTranscript: Story = {
	play: async (context) => {
		await upload(context);
		await waitFor(() =>
			expect(
				within(context.canvasElement).getByRole('button', {
					name: /^(Save|שמור)$/
				})
			).toBeVisible()
		);
		await waitFor(() =>
			expect(
				context.canvasElement.querySelectorAll('a').length +
					context.canvasElement.querySelectorAll('[data-semester]').length
			).toBeGreaterThan(0)
		);
	}
};
export const Loading: Story = {
	parameters: { planner: { transcript: 'loading' } },
	play: async (context) => {
		await upload(context);
		await waitFor(() =>
			expect(
				context.canvasElement.querySelector('input[type=file]')
			).toBeDisabled()
		);
		await waitFor(() =>
			expect(context.canvasElement.querySelector('svg')).toBeVisible()
		);
	}
};
export const UnrecognizedFile: Story = {
	parameters: { planner: { transcript: 'invalid' } },
	play: async (context) => {
		await upload(context);
		await waitFor(() =>
			expect(
				context.canvasElement.querySelector('input[type=file]')
			).toBeEnabled()
		);
		await expect(
			context.canvasElement.querySelector('[data-semester]')
		).toBeNull();
	}
};
