# Technion CS degree planner

Plan your CS degree.

## Why?

For fun, this is an interesting project to work on.

## Data sources

1. Technion student services: https://students.technion.ac.il/local/technionsearch/course
1. Cheese fork histograms: https://michael-maltsev.github.io/technion-histograms

## Problems to solve

1. It's hard to iterate on entire degree plan:
   These are the current solutions:

   - [Sogrim](https://students.sogrim.org/) doesn't take into account course prerequisites.
   - [CheeseFork](https://cheesefork.cf/) only supports current and previous semesters.

   Both solutions also don't support **rapid** course re-ordering.

1. It's hard to find interesting courses that also have high median grades:

   - [Sogrim](https://students.sogrim.org/) has no course search capabilities
     (other than course code -> name translation).

   - [CheeseFork](https://cheesefork.cf/) has amazing data, but missing advanced query capabilities:
     1. No way to sort courses by median grade.
     1. No way to get course median by semester/professor.
     1. Course median doesn't take into account course prerequisites median
        (so you might find a high median course, but its prerequisites have low medians).

## Data model

The `static/_db` directory contains files representing degree and course information.

The goal is to represent each degree requirements in a static file format that is easy
to create from the catalog (currently manually, in the future automated), and easy to
parse from code.

Generally, information in these files is unstructured, and parsed at runtime.

> TO DO: In the future data will have to be structured.

### Year

Create a directory for each year. There are no connections between years.

### University-wide courses

For course lists that are relevant for all degrees, like english and malag
(general) courses, create a file with the list name in the year directory.

### Degree

Create a directory for each degree, in each year.

### Degree path

For each way to complete the degree (path), create a directory inside the degree directory.

#### Course lists

Each degree path has a `lists` directory, create a file with the list name inside it.
In the file, place the content of the course list.

#### Recommended semesters

Each degree path has a `recommended` directory, create a file called `semesterX` where
`X` is the semester number (start at `1`) containing the recommended semester courses.

### Requirements

Requirements can be complex, and we probably won't be able to perfectly represent the
requirements of each degree plan using plaintext files. To solve this, each degree
path will have its own validator script, so that custom logic for each degree is simple
to implement.

The one thing plan requirement validators have in common is the
semester validation protocol:

```typescript
type SVPRequest = string[][];

type Requirement =
	| {
			type: 'points';
			progress: [number, number];
			courses: string[];
	  }
	| {
			type: 'count';
			progress: [number, number];
			courses: string[];
	  }
	| {
			type: 'choice';
			choices: Record<string, Requirement[]>;
	  };
type SVPResponse = Record<string, Requirement[]>;
```

The `Request` object represent the courses arranged by semester.

The `Requirement` object represents a condition that must be fulfilled,
and an array represents multiple requirements that must be fulfilled.

Basically `Requirement` array allows representing `and`, and the `choice` type
allows representing `or`. Nesting `Requirement` and `choice` allows for arbitrary
combinations of course `points` and `count` conditions.

Point "transfer" are represented implicitly. For example when taking more
than 8 points in "science" courses, those points are counted as "list b" courses.
There won't be any explicit mention that a transfer occurred, but the courses
listed as "list b" **will** contain the transferred science courses.

#### Example

##### Request

```json
[
	["104031", "104166"],
	["104032", "114071"],
	["236781", "104174"]
]
```

##### Response

```json
{
	"core": [
		{
			"type": "points",
			"progress": [19.5, 84],
			"courses": ["104031", "104166", "104032", "114071", "104174"]
		}
	],
	"math": [
		{
			"type": "count",
			"progress": [1, 1],
			"courses": ["104174"]
		}
	],
	"science": [
		{
			"type": "points",
			"progress": [10, 8],
			"courses": ["114052", "114054", "134058"]
		},
		{
			"type": "choice",
			"options": {
				"physics chain": [
					{
						"type": "count",
						"progress": [2, 2],
						"courses": ["114052", "114054"]
					}
				],
				"physics-chemistry chain": [
					{
						"type": "count",
						"progress": [1, 2],
						"courses": ["114052"]
					}
				],
				"biology chain": [
					{
						"type": "count",
						"progress": [1, 2],
						"courses": ["134058"]
					}
				]
			}
		}
	],
	"list a": [
		{
			"type": "points",
			"progress": [5, 18],
			"courses": ["134058", "236781"]
		}
	],
	"faculty choice": [
		{
			"type": "points",
			"progress": [2, 24.5],
			"courses": ["134058"]
		}
	],
	"project": [
		{
			"type": "count",
			"progress": [0, 1],
			"courses": []
		}
	],
	"sport": [
		{
			"type": "count",
			"progress": [0, 2],
			"courses": []
		}
	],
	"english": [
		{
			"type": "count",
			"progress": [0, 2],
			"courses": []
		}
	],
	"general": [
		{
			"type": "points",
			"progress": [0, 6],
			"courses": []
		}
	],
	"other": [
		{
			"type": "points",
			"progress": [0, 2],
			"courses": []
		}
	]
}
```
