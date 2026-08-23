<script lang="ts">
    import type L from "leaflet";
    import 'leaflet/dist/leaflet.css';
    let map: L.Map | void;

    const arrayOfCoordinates: L.LatLngExpression[] = [
        [52.521961, 13.413004],
        [52.521060, 13.414911],
        [52.521970, 13.416022],
        [52.521728, 13.417370],
        [52.518469, 13.428276],
        [52.515790, 13.454157],
        [52.513495, 13.477016],
        [52.512118, 13.490261],
        [52.511318, 13.499087]
      ]

    async function createMap(container: HTMLDivElement) {
        const L = (await import('leaflet')).default;
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
</script>

<div class="w-full h-full bg-green-100" use:mapAction></div>