import catalogs from '$lib/assets/catalogs.json';

// type gymnastics to get catalogs in a type-safe way
// credit: https://chatgpt.com/share/67137b39-7de8-8002-a4aa-0556e0c86b5a
type NestedKeys<T, Depth extends number = 3> = Depth extends 0
	? []
	: T extends object
		? {
				[K in keyof T]: Depth extends 2 | 1 // Exclude "shared" at level 2, "he" at level 2 and 3
					? K extends 'shared' | 'he'
						? never
						: [K, ...NestedKeys<T[K], Decrement<Depth>>]
					: [K, ...NestedKeys<T[K], Decrement<Depth>>];
			}[keyof T]
		: [];

type Decrement<N extends number> = N extends 3 ? 2 : N extends 2 ? 1 : 0;

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	type Requirement = {
		name: string;

		/**
		 * Hebrew translation key for the requirement name.
		 */
		he?: string;

		/**
		 * The courses that satisfy this requirement.
		 * If empty, courses will be taken from the nested requirements.
		 */
		courses?: string[];

		/**
		 * The points required to satisfy this requirement.
		 * If empty, requirement does not require points.
		 */
		points?: number;

		/**
		 * The number of courses required to satisfy this requirement.
		 * If empty, requirement does not require a specific number of courses.
		 */
		count?: number;

		/**
		 * Name of the requirement to overflow to.
		 * If empty, courses will be taken from the nested requirements.
		 */
		overflow?: string;

		/**
		 * The choices available to satisfy this requirement.
		 * If empty, requirement does not have choices.
		 *
		 * To mark all nested requirements as mandatory, do not specify the amount,
		 * or set it to the number of requirements.
		 */
		nested?: Requirement[];

		/**
		 * The amount of nested requirements needed to satisfy this requirement.
		 * If empty, all nested requirements are mandatory.
		 */
		amount?: number;

		/**
		 * If present, is a hook function that can modify the progress.
		 * Will return the modified progress, can store a message
		 * to be displayed in the progress, in the `hook` field.
		 *
		 * If empty, this has no effect.
		 */
		hook?: (semesters: Course[][], progress: Progress) => Progress;
	};

	type RequirementHeader = Omit<Requirement, 'courses' | 'nested' | 'hook'> & {
		courses?: string;
		nested?: RequirementHeader[];
		hook?: string;
	};

	type Progress = {
		name: string;

		/**
		 * Hebrew translation key for the requirement name.
		 */
		he?: string;

		/**
		 * The courses that satisfy this requirement.
		 * If empty, courses will be taken from the nested requirements.
		 */
		courses: {
			done: Course[];
			options: Course[];
		};

		/**
		 * The points required to satisfy this requirement.
		 * If empty, requirement does not require points.
		 */
		points: {
			done: number;
			required: number;
		};

		/**
		 * The number of courses required to satisfy this requirement.
		 * If empty, requirement does not require a specific number of courses.
		 */
		count: {
			done: number;
			required: number;
		};

		/**
		 * Name of the requirement to overflow to.
		 * If empty, courses will be taken from the nested requirements.
		 */
		overflow?: {
			target: string;
			type: 'points' | 'count';
			value: number;
		};

		/**
		 * The choices available to satisfy this requirement.
		 * If empty, requirement does not have choices.
		 *
		 * To mark all nested requirements as mandatory, do not specify the amount,
		 * or set it to the number of requirements.
		 */
		nested: {
			done: Progress[];
			options: Progress[];
		};

		/**
		 * The amount of nested requirements needed to satisfy this requirement.
		 * If empty, all nested requirements are mandatory.
		 */
		amount: {
			done: number;
			required: number;
		};

		/**
		 * If present, is the msg returned by the hook function.
		 *
		 * If empty, no hook was run.
		 */
		hook?: { he: string; en: string };
	};

	type Catalog = {
		degree: Degree;
		recommended: string[][];
		requirement: Requirement;
	};

	type UserData = {
		semesters: string[][];
		currentSemester: number;
		wishlist: string[];
		username?: string;
		degree?: Degree;
	};

	type Degree = NestedKeys<typeof catalogs>;

	type CourseConnections = {
		dependencies: string[][];
		adjacent: string[];
		exclusive: string[];
	};

	type Test = {
		year: number;
		monthIndex: number;
		day: number;
	};

	type StudyDays = {
		first: [Course, Date];
		next: [Course, number][];
	};

	type Course = {
		code: string;
		name?: string;
		points?: number;
		median?: number;
		connections?: CourseConnections;
		about?: string;
		tests?: [Test, Test | null];
		seasons?: CourseSeasons;
		current?: boolean;
		faculty?: string;
	};

	type CourseSeasons =
		| ['Winter', 'Spring', 'Summer']
		| ['Winter', 'Spring']
		| ['Winter', 'Summer']
		| ['Spring', 'Summer']
		| ['Winter']
		| ['Spring']
		| ['Summer'];
}

export {};
