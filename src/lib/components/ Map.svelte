<script lang="ts">
    import type L from "leaflet";
    import 'leaflet/dist/leaflet.css';
    import {densifySegment} from "$lib/utils";
    import {setMapContext} from '$lib/mapContext';
    import { onMount } from "svelte";
    let map: L.Map | undefined = $state(undefined);
    let svgOverlay: SVGSVGElement | undefined = $state(undefined)

    // init setMapContext with undefined values
    setMapContext({
        getMap: () => map,
        getSvgOverlay: () => svgOverlay
    })

    // Bringing coordinates in as props
    let {arrayOfCoordinates, children} = $props()
    let w: number = $state(0)
    let h:number = $state(0)

    // Here I input an original array with coordinates, already ordered according to my walk
    // I return a "densified" array, where more in-between points are generated
    function createMoreCoordinates(initialArrayOfCoordinates: L.LatLngExpression[], maxDeltaKm: number) {
        const out: L.LatLngExpression[]  = []
        for (let index = 0; index < initialArrayOfCoordinates.length - 1; index++) {
            const a: L.LatLngExpression = initialArrayOfCoordinates[index];
            const b: L.LatLngExpression = initialArrayOfCoordinates[index + 1];
            densifySegment(a, b, maxDeltaKm, out)
        }
        return out;
    }

    const moreCoordinates: L.LatLngExpression[] = $derived(createMoreCoordinates(arrayOfCoordinates, 0.2));

    async function createMap(container: HTMLDivElement) {
        // async import to avoid leaflet attaching itself to non-existing window
        const L = (await import('leaflet')).default;
        // init map with fix zoom and no control
        let m = L.map(container, {
            minZoom: 18,
            maxZoom: 18,
            zoomControl: false
        }).setView(arrayOfCoordinates[0], 18);

        
        L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
            attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
            &copy;<a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
            subdomains: 'abcd',
            maxZoom: 18
        }
        ).addTo(m);

        L.polyline(arrayOfCoordinates, {color: 'red'}).addTo(m);

        for (let index = 0; index < moreCoordinates.length; index++) {
            const setOfCoordinates = moreCoordinates[index];
            L.marker(setOfCoordinates).addTo(m);
        }

        const svgLayer = L.svg().addTo(m);

        return m
    }

    function mapAction(container: HTMLDivElement) {
        createMap(container).then((m) => {
            map = m
        });

        return {
            destroy: () => {
                map?.remove(),
                map = void(0);
            }
        }
    }

    // Interaction: the user clicks back and forth to "walk" the path
    // index for position
    let indexOfWalkPosition: number = $state(0);
    // set of coordinates for the walk, updates on click
    let currentWalkPosition: L.LatLngExpression = $derived(moreCoordinates[indexOfWalkPosition])

    function goTo(direction: string) {
        if (!map) return;

        if (direction === 'back') {
            indexOfWalkPosition = indexOfWalkPosition > 0 
            ? indexOfWalkPosition - 1
            : indexOfWalkPosition;
        } else {
            indexOfWalkPosition = indexOfWalkPosition < moreCoordinates.length 
            ? indexOfWalkPosition + 1 
            : indexOfWalkPosition;  
        } 
        map.panTo(currentWalkPosition, {animate: true, duration: 1})
    }

    onMount(()=> {
        console.log('[MapParent] context set');
    })

    // Re-run setMapContext after map has been created
    $effect(() => {
        setMapContext({
            getMap: () => map,
            getSvgOverlay: () => svgOverlay
        })
    })
    
</script>
<div class="h-full relative">
    <div class="h-20 bg-red-200 z-2 flex items-stretch sticky top-0 z-3">
        <button class="bg-purple-100 w-1/2 text-center border" onclick={() => goTo('back')}>back</button>
        <button class="bg-purple-100 w-1/2 text-center border" onclick={() => goTo('forward')}>forth</button>
    </div>
    <div class="w-full h-full bg-green-100 absolute top-0 z-1" use:mapAction bind:clientWidth={w} bind:clientHeight={h}></div>
    {@render children?.()}
</div>