<script lang="ts">
    import type L from "leaflet";
    import 'leaflet/dist/leaflet.css';
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

        for (let index = 0; index < arrayOfCoordinates.length; index++) {
            const setOfCoordinates = arrayOfCoordinates[index];
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
    let currentWalkPosition: L.LatLngExpression = $derived(arrayOfCoordinates[indexOfWalkPosition])

    function walkBack() {
        if (!map) return;

        indexOfWalkPosition = indexOfWalkPosition > 0 
        ? indexOfWalkPosition - 1
        : indexOfWalkPosition;
        map.panTo(currentWalkPosition, {animate: true, duration: 1})
    }

    function walkForward () {
        if (!map) return;

        indexOfWalkPosition = indexOfWalkPosition < arrayOfCoordinates.length 
        ? indexOfWalkPosition + 1 
        : indexOfWalkPosition;
        map.panTo(currentWalkPosition, {animate: true, duration: 1})
    }
</script>
<div class="h-full relative">
<div class="h-20 bg-red-200 z-2 flex items-stretch sticky top-0 z-2">
    <button class="bg-purple-100 w-1/2 text-center border" onclick={walkBack}>back</button>
    <button class="bg-purple-100 w-1/2 text-center border" onclick={walkForward}>forth</button>
</div>
<div class="w-full h-full bg-green-100 absolute top-0 z-1" use:mapAction></div>
</div>