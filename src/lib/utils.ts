import * as turf from "@turf/turf";

// function using turf to generating in-between pairs of coordinates from a set of initial ones.
// I use it so that panTo is smoother and the user always walks in regular intervals
export function densifySegment(
        a: L.LatLngExpression, 
        b: L.LatLngExpression, 
        maxDistance: number, 
        out: L.LatLngExpression[]
    ) {
    // calculate distance
    const dist = turf.distance(a as turf.Coord, b as turf.Coord, {units: 'kilometers'});

    // if the distance is already smaller than delta, pushes coordinates
    if (dist <= maxDistance) {
        out.push(a);
        return;
    }

    // if not, it calculates the midpoint between a and b
    // then runs itself again, until the delta is met
    const midpoint = turf.midpoint(a as turf.Coord, b as turf.Coord);
    const midpointCoordinates = midpoint.geometry.coordinates
    const midpointTuples: L.LatLngExpression = [midpointCoordinates[0], midpointCoordinates[1]]
    densifySegment(a, midpointTuples, maxDistance, out);
    densifySegment(midpointTuples, b, maxDistance, out);
}