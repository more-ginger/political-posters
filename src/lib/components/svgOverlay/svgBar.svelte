<script lang="ts">
    import * as d3 from 'd3';
    import {partiesWithColors} from '$lib/utils.js';
    let {point} = $props();
    const width: number = $state(8);
    const dHeight: number = $state(100);
    const x:number = $derived(point.x - width/2);
    

    // Sort posters from lower to higher and returns a flat array
    function sortPostersArray(p: {posters: {box: {sizeCm: number}}[]}) {
        if (p.posters.length === 0) return [];
        const postersCopy = p.posters.slice()
        return postersCopy.sort((a,b) => {return a.box.sizeCm-b.box.sizeCm})
    }

    // calculates the height of the bar based on the number of posters
    function calculatePoleHeight(p: [], h: number) {
        if (p.length === 0) return h; 
        return 70 * p.length
    }

    const sortedPosters: [] = $derived(sortPostersArray(point))
    const height = $derived(calculatePoleHeight(sortedPosters, dHeight));
    const y:number = $derived(point.y - height);

    function createPosterData(posters) {
        if (posters.length === 0) return [];
        let py = 0;
        return posters.map((p, i: number) => {
            py = py + 70;
            return {
                y: py,
                height: i === 0 ? 70 : 75,
                ...p
            }
        })
    }

    const postersData = $derived(createPosterData(sortedPosters));

</script>
<g>
    <rect 
        class="pointer-events-auto"
        x={x}
        y={y} 
        width={width}
        height={height}
        rx="5" 
        ry="5" 
        stroke="black" 
        fill="white"
    ></rect>
    {#if postersData}
        {#each postersData as poster}
            <rect 
                class="pointer-events-auto"
                x={x}
                y={point.y - poster.y} 
                width={width}
                height={poster.height}
                rx="5" 
                ry="5" 
                stroke="white" 
                fill={partiesWithColors[poster.party]}
            ></rect>
        {/each}
    {/if}
    <rect 
        class="pointer-events-auto"
        x={x}
        y={y} 
        width={width}
        height={height}
        rx="5" 
        ry="5" 
        stroke="black" 
        fill="transparent"
    ></rect>
</g>
