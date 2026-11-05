// The world's composition root (overview § 5). WP-01 owns this file and nobody
// edits it afterwards: every package replaces only its own stub component.

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { AgXToneMapping, SRGBColorSpace } from "three";
import { AudioSystem } from "./audio";
import { CameraRig } from "./camera";
import { Character } from "./character";
import { WorldFlow } from "./flow";
import { Atmosphere } from "./fx";
import { runtime } from "./runtime";
import { Scene } from "./scene";
import { useStore, type Tier } from "./store";
import { Ui } from "./ui";
import type {} from "./boot/types";

/** Device pixel ratio cap per tier (overview § 8). */
export const DPR_CAP: Record<Tier, number> = { high: 2, low: 1.5 };

/** How often `?debug=stats` publishes `window.__worldStats`. */
const STATS_EVERY_FRAMES = 30;

export interface AppProps {
  /** Called when the world can't continue (e.g. the WebGL context is lost). */
  onFatal?: (reason: string, error?: unknown) => void;
}

export function App({ onFatal }: AppProps) {
  const tier = useStore((s) => s.tier);

  return (
    <>
      <Canvas
        aria-hidden="true"
        dpr={[1, DPR_CAP[tier]]}
        gl={{ toneMapping: AgXToneMapping, outputColorSpace: SRGBColorSpace }}
        camera={{ fov: 50, near: 0.1, far: 1000 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ContextLossWatcher onLost={() => onFatal?.("WebGL context lost")} />
        {runtime.debug.stats && <StatsProbe />}
        {/* <Physics> suspends while Rapier's WASM starts, and the scene while
            models load; this boundary keeps the rest of the canvas (and the
            loadProgress reporting) alive meanwhile. */}
        <Suspense fallback={null}>
          <Physics>
            <Scene />
            <Character />
            <CameraRig />
            <Atmosphere />
            <AudioSystem />
            <WorldFlow />
          </Physics>
        </Suspense>
      </Canvas>
      <Ui />
    </>
  );
}

/** Reports a lost WebGL context. Unmounting removes the listener first, so
 *  R3F's own forceContextLoss() on teardown isn't reported. */
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const canvas = useThree((s) => s.gl.domElement);
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;

  useEffect(() => {
    const handle = () => onLostRef.current();
    canvas.addEventListener("webglcontextlost", handle);
    return () => canvas.removeEventListener("webglcontextlost", handle);
  }, [canvas]);

  return null;
}

/**
 * `?debug=stats`: writes the previous frame's draw calls and triangles to
 * `window.__worldStats` every 30 frames. Auto-reset is off and the counters
 * reset at the start of each frame, so multi-pass rendering (the effect
 * composer, reflections) is counted in full.
 */
function StatsProbe() {
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);

  useEffect(() => {
    const previous = gl.info.autoReset;
    gl.info.autoReset = false;
    gl.info.reset();
    return () => {
      gl.info.autoReset = previous;
    };
  }, [gl]);

  // Negative priority: runs before every other frame callback and doesn't take
  // over rendering.
  useFrame(() => {
    frame.current += 1;
    if (frame.current % STATS_EVERY_FRAMES === 0) {
      const { calls, triangles } = gl.info.render;
      window.__worldStats = { calls, triangles };
    }
    gl.info.reset();
  }, -1000);

  return null;
}
