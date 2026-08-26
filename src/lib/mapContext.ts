import {getContext, setContext} from 'svelte';
import type L from 'leaflet';

export interface MapContext {
    getMap: () => L.Map | undefined
}

export function setMapContext (context: MapContext) {
    setContext('MAP_CONTEXT_KEY', context)
}

export function getMapContext(): MapContext {
    const cxt = getContext<MapContext>('MAP_CONTEXT_KEY')
    if (!cxt) throw new Error('getMapContext() must be called inside a component whose ancestor called setMapContext()')
    return cxt
}

