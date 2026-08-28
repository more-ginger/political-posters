<script lang="ts">
    import {frankfurterAllee} from "$lib/walks";
    import Map from "$lib/components/ Map.svelte";
    import SvgOverlay from "$lib/components/SvgOverlay.svelte";

    let {data} = $props()
    let mapRef: ReturnType<typeof Map> | undefined = $state(undefined);
    let direction: string = $state('')

    // The route itself lives in $lib/walks, because the server builds the
    // corridor query from the same coordinates this map draws. Two copies would
    // drift, and the symptom would be posters missing from a walk that looks
    // perfectly correct on screen.
    const arrayOfCoordinates: L.LatLngExpression[] = frankfurterAllee.coordinates;

    // Triggers exported function in map
    function goTo(dir: string) {
        mapRef?.triggerPan(dir)
    }

</script>

<div class="w-full bg-yellow-200 h-screen m-auto">
    <div class="h-20 bg-red-200 z-2 flex items-stretch sticky top-0 z-3">
        <button class="bg-purple-100 w-1/2 text-center border" onclick={() => goTo('back')}>back</button>
        <button class="bg-purple-100 w-1/2 text-center border" onclick={() => goTo('forward')}>forth</button>
    </div>
    <Map bind:this={mapRef} arrayOfCoordinates={arrayOfCoordinates} direction={direction}>
        <SvgOverlay data={data.submissions}/>
    </Map>
</div>