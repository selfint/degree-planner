<script>
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	export let nodes = [];
	export let edges = [];

	onMount(() => {
		const svg = d3.select('#dag').attr('width', 800).attr('height', 600);

		const simulation = d3
			.forceSimulation(nodes)
			.force(
				'link',
				d3.forceLink(edges).id((d) => d.id)
			)
			.force('charge', d3.forceManyBody())
			.force('center', d3.forceCenter(800 / 2, 600 / 2));

		const link = svg
			.append('g')
			.attr('class', 'links')
			.selectAll('line')
			.data(edges)
			.enter()
			.append('line')
			.attr('stroke-width', 2);

		const node = svg
			.append('g')
			.attr('class', 'nodes')
			.selectAll('circle')
			.data(nodes)
			.enter()
			.append('circle')
			.attr('r', 5)
			.attr('fill', 'blue')
			.call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended));

		node.append('title').text((d) => d.id);

		simulation.nodes(nodes).on('tick', ticked);

		simulation.force('link').links(edges);

		function ticked() {
			link
				.attr('x1', (d) => d.source.x)
				.attr('y1', (d) => d.source.y)
				.attr('x2', (d) => d.target.x)
				.attr('y2', (d) => d.target.y);

			node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
		}

		function dragstarted(event, d) {
			if (!event.active) simulation.alphaTarget(0.3).restart();
			d.fx = d.x;
			d.fy = d.y;
		}

		function dragged(event, d) {
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragended(event, d) {
			if (!event.active) simulation.alphaTarget(0);
			d.fx = null;
			d.fy = null;
		}
	});
</script>

<svg id="dag"></svg>

<style>
	.nodes circle {
		stroke: #fff;
		stroke-width: 1.5px;
	}

	.links line {
		stroke: #999;
		stroke-opacity: 0.6;
	}
</style>
