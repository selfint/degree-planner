<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	import { courses } from '$lib/stores';

	// for each course, get the max depth of its dependencies
	// if the depth is greater than the current ring, add a new ring
	const courseDepths = new Map<string, number>();
	const courseRings = new Map<string, number>();
	let maxDepth = 0;

	const radius = 200;
	let ringSpacing = radius;
	$: {
		for (const course of $courses) {
			let depth =
				Math.max(
					...(course.info?.connections?.dependencies ?? []).flatMap((deps) =>
						deps.map((dep) => courseDepths.get(dep) ?? 0)
					)
				) + 1;
			depth = depth === Number.NEGATIVE_INFINITY ? 0 : depth;
			courseDepths.set(course.code, depth);
		}
		maxDepth = Math.max(...Array.from(courseDepths.values()));
		ringSpacing = radius / (maxDepth + 1);

		for (const course of $courses) {
			const depth = courseDepths.get(course.code) ?? 0;
			courseRings.set(course.code, maxDepth - depth);
		}
	}

	let svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>;
	let nodes: d3.Selection<SVGCircleElement, Course, d3.BaseType, unknown>;
	let rings: d3.Selection<SVGCircleElement, number, d3.BaseType, unknown>;

	onMount(() => {
		svg = d3.select('#dag').attr('width', 800).attr('height', 600);
		nodes = svg.selectAll('circle');
		rings = svg.selectAll('circle.ring');
	});

	$: if (rings) {
		console.log('debug');
		const data = Array.from({ length: maxDepth + 1 }, (_, i) => i);
		console.log([maxDepth, data, courseDepths]);
		rings = rings.data(data);
		rings.exit().remove();

		rings = rings
			.enter()
			.append('circle')
			.merge(rings)
			.attr('cx', 400)
			.attr('cy', 300)
			.attr('r', (d, i) => {
				return ringSpacing * (d + 1);
			})
			.attr('fill', 'none')
			.attr('stroke', 'black')
			.attr('class', 'ring');
	}

	$: if (nodes) {
		nodes = nodes.data($courses);
		nodes.exit().remove();

		let nodeEnter = nodes.enter().append('circle').attr('r', 5);

		nodeEnter.append('title').text((d) => 'hello');

		nodes = nodeEnter
			.merge(nodes)
			.attr('cx', (d) => {
				const ring = courseRings.get(d.code) ?? 0;
				const itemsInRing = $courses.filter((c) => courseRings.get(c.code) === ring);
				const indexInRing = itemsInRing.indexOf(d);
				return (
					400 +
					Math.cos((indexInRing / itemsInRing.length) * 2 * Math.PI) * (ringSpacing * (ring + 0.5))
				);
			})
			.attr('cy', (d) => {
				const ring = courseRings.get(d.code) ?? 0;
				const itemsInRing = $courses.filter((c) => courseRings.get(c.code) === ring);
				const indexInRing = itemsInRing.indexOf(d);
				return (
					300 +
					Math.sin((indexInRing / itemsInRing.length) * 2 * Math.PI) * (ringSpacing * (ring + 0.5))
				);
			});
	}
</script>

<svg id="dag"></svg>
