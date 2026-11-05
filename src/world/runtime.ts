// Runtime: overview § 6.5. Data that changes every frame lives in this mutable
// singleton rather than the store, so it never triggers React re-renders.
// Read and write it freely from useFrame; never put it in React state.

import { Vector3 } from "three";

export const runtime = {
  character: {
    position: new Vector3(), // three.js world space, written by WP-05 every frame
    yaw: 0,
    speed: 0, // m/s
    teleport: (_p: Vector3, _yaw: number) => {}, // replaced by WP-05
  },
  debug: { shot: null as string | null, freeze: false, stats: false }, // from the URL, set by WP-01
};

export type Runtime = typeof runtime;
