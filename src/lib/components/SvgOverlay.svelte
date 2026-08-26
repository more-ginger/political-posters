<script lang="ts">
    import type L from 'leaflet';
    import {getMapContext} from '$lib/mapContext';
    const {getMap, getSvgOverlay} = getMapContext()
    
    function recomputePositions(): L.LeafletEventHandlerFn | undefined {
        const map = getMap();
        if (!map) return;
    }


    $effect(() => {
        console.log('[D3Overlay] context received', getMap(), getSvgOverlay());

        const map = getMap();
        if (!map) return;

        map.on('zoom viewreset move', recomputePositions);
        recomputePositions();

        return () => {
            map.off('zoom viewreset move', recomputePositions)
        }
    })
</script>
<svg width="100%" height="100%">
</svg>