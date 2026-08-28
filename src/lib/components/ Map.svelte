<script lang="ts">
    import type L from "leaflet";
    import 'leaflet/dist/leaflet.css';
    import {densifySegment} from "$lib/utils";
    import {setMapContext} from '$lib/mapContext';
    let map: L.Map | undefined = $state(undefined);

    // init setMapContext with undefined values
    setMapContext({
        getMap: () => map
    })

    // Bringing coordinates in as props
    let {arrayOfCoordinates, children} = $props()

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
        'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
        {
            attribution: `&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
            subdomains: 'abcd',
            maxZoom: 18
        }
        ).addTo(m);

        L.polyline(arrayOfCoordinates, {color: 'black'}).addTo(m);
        // adds svg overlay layer for datavis
        L.svg().addTo(m);

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

    /** Interaction: the user clicks back and forth to "walk" the path
    index for position
    */
    let indexOfWalkPosition: number = $state(0);
    // set of coordinates for the walk, updates on click
    let currentWalkPosition: L.LatLngExpression = $derived(moreCoordinates[indexOfWalkPosition])

    function panMap(direction: string) {
        // Checks if map exists or if direction is not default
        if (!map || direction === '') return;

        // Changes position to pan to.
        if (direction === 'back') {
            indexOfWalkPosition = indexOfWalkPosition > 0 
            ? indexOfWalkPosition - 1
            : indexOfWalkPosition;
        } else {
            indexOfWalkPosition = indexOfWalkPosition < moreCoordinates.length - 1
            ? indexOfWalkPosition + 1 
            : indexOfWalkPosition;  
        }

        // Uses leaflet to pan.
        map.panTo(currentWalkPosition, {animate: true, duration: 1});
    }

    // export for parent to trigget panMap function
    export function triggerPan(direction:string) {
        panMap(direction);
    }

    // Re-run setMapContext after map has been created
    $effect(() => {
        setMapContext({
            getMap: () => map
        })
    })
    
</script>
<div class="h-full relative">
    <div class="w-full h-full bg-green-100 absolute top-0 z-1" use:mapAction></div>
    {@render children?.()}
</div>