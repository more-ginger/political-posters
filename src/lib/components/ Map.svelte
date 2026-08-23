<script lang="ts">
    import type L from "leaflet";
    import 'leaflet/dist/leaflet.css';
    import * as turf from "@turf/turf"
  import { trusted } from "svelte/legacy";
    let map: L.Map | void = $state(undefined);

    // current walk, this could be passed as props if other walks will be planned
    const arrayOfCoordinates: L.LatLngExpression[] = [
        [52.521961, 13.413004],
        [52.521060, 13.414911],
        [52.521970, 13.416022],
        [52.521728, 13.417370],
        [52.520182, 13.422436],
        [52.518469, 13.428276],
        [52.515790, 13.454157],
        [52.513495, 13.477016],
        [52.512118, 13.490261],
        [52.511318, 13.499087]
      ]

    // TO DO: move to an utils.js file
    // function using turf to generating in-between pairs of coordinates from initial ones.
    // I use it so that panTo is smoother and the user always walks in regular intervals
    function densifySegment(a: number[], b: number[], maxDistance: number, out: number[]) {
        // calculate distance
        const dist = turf.distance(a, b, {units: 'kilometers'});

        // if the distance is already smaller than delta, pushes coordinates
        if (dist <= maxDistance) {
            out.push(a);
            return;
        }

        // if not, it calculates the midpoint between a and b
        // then runs itself again, until the delta is met
        const midpoint = turf.midpoint(a, b);
        const midpointCoordinates = midpoint.geometry.coordinates
        const midpointTuples = [midpointCoordinates[0], midpointCoordinates[1]]
        densifySegment(a, midpointTuples, maxDistance, out);
        densifySegment(midpointTuples, b, maxDistance, out)
    }

    // Here I input an original array with coordinates, already ordered according to my walk
    // I return a "densified" array, where more in-between points are generated
    function createMoreCoordinates(initialArrayOfCoordinates: L.LatLngExpression[], maxDeltaKm: number) {
        const out: number[] = []
        for (let index = 0; index < initialArrayOfCoordinates.length - 1; index++) {
            const a: number[] = initialArrayOfCoordinates[index];
            const b: L.LatLngExpression = initialArrayOfCoordinates[index + 1];

            densifySegment(a, b, maxDeltaKm, out)
            
        }

        return out;
    }

    const moreCoordinates = $derived(createMoreCoordinates(arrayOfCoordinates, 0.2));

    async function createMap(container: HTMLDivElement) {
        // async import to avoid leaflet attaching itselt to non-existing window
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
            console.log(setOfCoordinates)
            L.marker(setOfCoordinates).addTo(m);
        }

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
</script>
<div class="h-full relative">
<div class="h-20 bg-red-200 z-2 flex items-stretch sticky top-0 z-2">
    <button class="bg-purple-100 w-1/2 text-center border" onclick={() => goTo('back')}>back</button>
    <button class="bg-purple-100 w-1/2 text-center border" onclick={() => goTo('forward')}>forth</button>
</div>
<div class="w-full h-full bg-green-100 absolute top-0 z-1" use:mapAction></div>
</div>