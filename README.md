# Technion CS degree planner

Plan your CS degree.

## Why?

For fun, this is an interesting project to work on.

## Data sources

1. Technion Course mailing lists: https://techwww.technion.ac.il/cgi-bin/courses/courses.pl
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
