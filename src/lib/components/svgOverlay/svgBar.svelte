<script lang="ts">
    let {point} = $props();
    const x = $derived(point.x - 3)
    const y = $derived(point.y - 100);
</script>
<g>
    <rect class="pointer-events-auto" x={x} y={y} width="6" height="100" rx="2" ry="2" stroke="black" fill="white"></rect>
</g>
