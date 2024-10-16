<p align="center">
  <img src="https://raw.githubusercontent.com/selfint/degree-planner/refs/heads/main/static/favicon.png" alt="Technion degree planner logo" width="150"/>
</p>

<p align="center">
  <a href="https://github.com/selfint/degree-planner/actions/workflows/test.yml">
    <img src="https://github.com/selfint/degree-planner/actions/workflows/test.yml/badge.svg" alt="Test Status">
  </a>

  <a href="https://github.com/selfint/degree-planner/actions/workflows/data.yml">
  <img src="https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/selfint/degree-planner/actions/workflows/data.yml/runs&label=Data&query=$.workflow_runs[0].created_at&color=blue&style=flat" alt="Data">
</a>
</p>

<h1><p align="center">Technion Degree Planner</p></h1>

## Goal

Build a tool for planning an entire Technion degree.

## Why?

For fun, this is an interesting project to work on.

## Data sources

1. ~Technion student services: https://students.technion.ac.il/local/technionsearch/course~ (deprecated)
1. Cheese fork histograms: https://michael-maltsev.github.io/technion-histograms
1. Technion SAP: https://portalex.technion.ac.il

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

The benefit of this data model is that non-technical users can easily suggest fixes
to wrong requirements. For example if the `cs/3_year/core/points` requirement is wrong,
(e.g. it's `84` and should be `84.5`) all that is required to fix it is changing the
content of the file from `84` to `84.5`.

Generally, information in these files is unstructured, and parsed at runtime. Again
the benefit here is that no technical knowledge is required to fix mistakes. If courses
are missing from a requirement, all the is required is to copy paste text _containing_ the
course codes, and pasting it in the file.

In the future data this might change, since there are also downsides to unstructured data:

1. A lot of unnecessary data.
2. Diffing files isn't very informative.
3. Removing courses from a file is a bit harder (requires an automated find & replace tool).
4. Technically slower that storing a deduplicated list of course codes, but this isn't a
   big issue since we are dealing with very small amount of text (entire catalogs are just 10s of `kb`s).

### Year

Create a directory for each year. There are no connections between years.

### University-wide courses

For course lists that are relevant for all degrees, like english and malag
(general) courses, create a file with the list name in the year directory.

### Degree

Create a directory for each degree, in each year.

### Degree path

For each way to complete the degree (path), create a directory inside the degree directory.

#### Recommended semesters

Each degree path has a `recommended` directory, create a file called `semesterX` where
`X` is the semester number (start at `1`) containing the recommended semester courses.

### Requirements

Requirements can be complex, as such their representation has to be flexible, while sticking
to plaintext files only.

Each degree path has a `requirements` directory. This directory contains the subdirectories
named after requirements to complete the degree. A requirement directory can contain:

1. `courses` file - A list of courses relevant to the requirement. If this file is missing,
   the courses are taken recursively from `courses` files in subdirectories.
1. `count` file - A file containing a single number specifying the **amount** of courses
   from the `courses` file that are needed to fulfill the requirement.
1. `points` file - A file containing a single float specifying the **points** of courses
   from the `courses` file that are needed to fulfill the requirement.
1. `choice` **subdirectory** - A **subdirectory** containing:
   1. `<subdirectory>` subdirectory - A subdirectory named after a sub-requirement needed
      to complete the requirement.
   1. `amount` file - A file containing a single number specifying the **amount** of choices
      from the subdirectories that are needed to fulfill the requirement.
1. `overflow` file - A file containing a single line specifying the list to transfer
   overflowing `points` **and** `count` requirements to.

   > Point overflow - some lists (like the "science" list in the CS degree) have an amount
   > of points required, with "overflowing" points transferred to a different list ("list b"
   > in the CS degree's case). To achieve this, any condition that has overflow can add an
   > "overflow" file, with the name of the requirement it overflows to.
   >
   > In the future we might need to more fine-grained control of overflow,
   > such as "only points" or "only specific courses". Any of these should
   > be possible by making overflow a directory analogous to a nested
   > requirement.

   Both the source requirement and the overflow requirement must have the same type
   of requirement (either `points` or `count`), currently there is no support for
   mixing the two.

   Also, `choice` requirements can't overflow. That is why the `choice` directory
   has an `amount` file, not a `count` file.

## Acknowledgements

- [Michael Maltsev](https://github.com/michael-maltsev) for data in
  [technion-histograms](https://github.com/michael-maltsev/technion-histograms),
  and for help understanding the SAP API from
  [technion-sap-info-fetcher](https://github.com/michael-maltsev/technion-sap-info-fetcher).

- [Sogrim team](https://github.com/sogrim/technion-sogrim) for inspiration from
  their degree planner.

- Big thanks to the beta testers for their feedback:

  - [Almog Levy](https://github.com/Almoglevy2k)
  - [Yotam Freund](https://github.com/freundyotam)
