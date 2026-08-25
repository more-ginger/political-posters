<script lang="ts">
    import {frankfurterAllee} from "$lib/walks";
    import Map from "$lib/components/ Map.svelte";

    let {data} = $props()

    // The route itself lives in $lib/walks, because the server builds the
    // corridor query from the same coordinates this map draws. Two copies would
    // drift, and the symptom would be posters missing from a walk that looks
    // perfectly correct on screen.
    const arrayOfCoordinates: L.LatLngExpression[] = frankfurterAllee.coordinates;

</script>

<div class="w-full bg-yellow-200 h-screen m-auto">
    <Map {arrayOfCoordinates} data={data.submissions}/>
</div>