<script lang="ts">
    import type L from 'leaflet';
    import {getMapContext} from '$lib/mapContext';
    const {getMap, getSvgOverlay} = getMapContext();
    const { data } = $props();
    let points: {x:number, y:number}[] = $state([])
    
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


    $inspect(points)
    $effect(() => {
        // console.log('[D3Overlay] context received', getMap(), getSvgOverlay());

        const map = getMap();
        if (!map) return;

        map.on('zoom viewreset move', recomputePositions);
        recomputePositions();

        return () => {
            map.off('zoom viewreset move', recomputePositions)
        }
    })
</script>
<svg width="100%" height="100%" class="absolute inset-0 z-100 pointer-events-none">
        {#each points as point}
            <circle cx={point.x} cy={point.y} r="5" fill="black"></circle>
        {/each}
</svg>