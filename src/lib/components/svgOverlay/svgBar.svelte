<script lang="ts">
    let {point} = $props();
    const width: number = $state(8);
    const x:number = $derived(point.x - width/2)
    const y:number = $derived(point.y - 100);
</script>
<g>
    <rect class="pointer-events-auto" x={x} y={y} width={width} height="100" rx="5" ry="5" stroke="black" fill="white"></rect>
</g>
