import type { Meta, StoryObj } from '@storybook/sveltekit';
import SettingsPage from '../../routes/app/(withCourseData)/settings/+page.svelte';
import {
	catalogs,
	courses,
	getCourseData,
	pending
} from '../../../.storybook/fixtures';
import { baseRouteData, makeFirebase, routeState } from './fixtures';
import { expect, waitFor } from 'storybook/test';

const data = {
	...baseRouteData,
	getCourseData,
	catalogs: Promise.resolve(catalogs)
};
const meta = {
	title: 'Pages/Settings',
	component: SettingsPage,
	args: { data },
	// Auth objects are recreated on mount so signing out cannot leak across stories.
	render: ({ data }, { parameters }) => ({
		Component: SettingsPage,
		props: {
			data: {
				...data,
				firebase: makeFirebase(parameters.planner?.signedIn === true)
			}
		}
	}),
	parameters: {
		componentPath: 'src/routes/app/(withCourseData)/settings/+page.svelte',
		planner: { plan: 'populated' },
		sveltekit_experimental: routeState('/app/settings')
	}
} satisfies Meta<typeof SettingsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Guest: Story = {};
export const SignedIn: Story = {
	parameters: { planner: { signedIn: true } }
};
export const ChooseDegree: Story = {
	parameters: {
		planner: { plan: 'empty', user: { degree: undefined, path: undefined } }
	}
};
export const EmptyPlan: Story = { parameters: { planner: { plan: 'empty' } } };
export const CatalogLoading: Story = {
	args: { data: { ...data, catalogs: pending<Catalogs>() } }
};
export const ReadOnly: Story = {
	parameters: { planner: { online: false } }
};
export const Exemptions: Story = {
	parameters: { planner: { user: { exemptions: [courses[2].code] } } }
};

export const SignInFailed: Story = {
	parameters: { planner: { signInError: true } },
	play: async ({ canvasElement }) => {
		const button = canvasElement
			.querySelector<HTMLImageElement>('img[alt="Google Logo"]')
			?.closest('button');
		await expect(button).not.toBeNull();
		button?.click();
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-testid="sign-in-error"]')
			).not.toBeNull()
		);
	}
};
