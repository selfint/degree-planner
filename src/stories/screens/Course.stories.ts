import type { Meta, StoryObj } from '@storybook/sveltekit';
import CoursePage from '../../routes/app/(withCourseData)/course/[code]/+page.svelte';
import {
	courses,
	courseData,
	getCourseData,
	pending
} from '../../../.storybook/fixtures';
import { baseRouteData, routeState } from './fixtures';
import { railCourses, railCourseData, getRailCourseData } from './railFixtures';

const course = courses[1];
const data = {
	...baseRouteData,
	getCourseData,
	courseData: Promise.resolve(courseData),
	course: Promise.resolve(course)
};
const meta = {
	title: 'Pages/Course',
	component: CoursePage,
	args: { data },
	parameters: {
		componentPath: 'src/routes/app/(withCourseData)/course/[code]/+page.svelte',
		planner: { plan: 'empty', personalPlanReady: true },
		sveltekit_experimental: routeState(`/app/course/${course.code}`, {
			code: course.code
		})
	}
} satisfies Meta<typeof CoursePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Planned: Story = {
	parameters: { planner: { plan: 'populated' } }
};
export const Wishlisted: Story = {
	parameters: { planner: { user: { wishlist: [course.code] } } }
};
export const Exempt: Story = {
	parameters: { planner: { user: { exemptions: [course.code] } } }
};
export const ReadOnly: Story = {
	parameters: { planner: { personalPlanReady: false, online: false } }
};
export const Loading: Story = {
	args: {
		data: {
			...data,
			course: pending<FullCourse>(),
			courseData: pending<CourseData>()
		}
	},
	parameters: { planner: { loading: true } }
};
export const MissingDetails: Story = {
	args: { data: { ...data, course: Promise.resolve({ code: course.code }) } }
};
export const UnavailableCourse: Story = {
	args: {
		data: {
			...data,
			course: Promise.resolve(courses[2])
		}
	},
	parameters: {
		sveltekit_experimental: routeState(`/app/course/${courses[2].code}`, {
			code: courses[2].code
		})
	}
};

export const RelatedCourses: Story = {
	args: {
		data: {
			...data,
			getCourseData: getRailCourseData,
			course: Promise.resolve({
				...course,
				connections: {
					dependencies: railCourses.map((item) => [item.code]),
					adjacent: railCourses.map((item) => item.code),
					exclusive: railCourses.map((item) => item.code)
				}
			}),
			courseData: Promise.resolve({
				...railCourseData,
				[courses[2].code]: {
					...courses[2],
					connections: {
						dependencies: [[course.code]],
						adjacent: [],
						exclusive: []
					}
				}
			})
		}
	}
};
