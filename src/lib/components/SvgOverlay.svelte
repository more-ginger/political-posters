<script lang="ts">
    import type L from 'leaflet';
    import SvgBar from './svgOverlay/svgBar.svelte';
    import {getMapContext} from '$lib/mapContext';
    const {getMap} = getMapContext();
    const { data } = $props();
    let points: {x:number, y:number}[] = $state([])
    
    // everytime the map state change (bc I drag or move) positions get calculated new
    function recomputePositions(): L.LeafletEventHandlerFn | undefined {
        const map = getMap();
        if (!map) return;

        points = data.map((d: {latitude: number, longitude: number}) => {
            const pixelCoords = map.latLngToContainerPoint([d.latitude, d.longitude])
            return {
                x: pixelCoords.x,
                y: pixelCoords.y
            }
        })
    }

    $effect(() => {
        // Assign map context only once the map has updated at least once
        const map = getMap();
        if (!map) return;

        // If context exists, triggers recomputePositions to calc correct x,y for dots
        map.on('zoom viewreset move', recomputePositions);
        recomputePositions();

        return () => {
            map.off('zoom viewreset move', recomputePositions)
        }
    })
</script>
<svg width="100%" height="100%" class="absolute inset-0 z-100 pointer-events-none">
        {#each points as point}
            <SvgBar point={point}/>
        {/each}
</svg>