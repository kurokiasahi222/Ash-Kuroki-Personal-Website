// World events: overview § 6.5. A small typed emitter (on/off/emit) for
// one-off happenings between packages. Change the event map only as a
// contract change in the overview.

import type { InteractionId, WalkTarget } from "./store";

export type WorldEvents = {
  interact: { id: InteractionId }; // flow → audio, flow's own animations
  arrive: { target: WalkTarget }; // character → flow
  footstep: Record<string, never>; // character → audio
  door: { open: boolean }; // flow → audio
  deck: { state: "enter" | "arrived" | "exit" }; // flow ↔ camera ↔ audio
  uiClick: Record<string, never>; // ui → audio
};

export type Handler<T> = (payload: T) => void;

/** Events whose payload is empty can be emitted without one: `emit("footstep")`. */
type PayloadArgs<T> =
  T extends Record<string, never> ? [payload?: T] : [payload: T];

export interface Emitter<E extends Record<string, object>> {
  /** Subscribes `handler`; returns a function that unsubscribes it. */
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void;
  off<K extends keyof E>(type: K, handler: Handler<E[K]>): void;
  /** Calls every handler of `type` synchronously, in subscription order. */
  emit<K extends keyof E>(type: K, ...args: PayloadArgs<E[K]>): void;
}

export function createEmitter<E extends Record<string, object>>(): Emitter<E> {
  const handlers = new Map<keyof E, Set<Handler<never>>>();

  const off: Emitter<E>["off"] = (type, handler) => {
    handlers.get(type)?.delete(handler as Handler<never>);
  };

  return {
    on(type, handler) {
      let set = handlers.get(type);
      if (!set) handlers.set(type, (set = new Set()));
      set.add(handler as Handler<never>);
      return () => off(type, handler);
    },
    off,
    emit(type, ...args) {
      const set = handlers.get(type);
      if (!set || set.size === 0) return;
      const payload = (args[0] ?? {}) as E[typeof type];
      // Copy first, so handlers may subscribe or unsubscribe while we emit.
      for (const handler of [...set] as Handler<E[typeof type]>[]) {
        try {
          handler(payload);
        } catch (error) {
          // One broken listener must not stop the others.
          console.error(`[events] "${String(type)}" handler failed`, error);
        }
      }
    },
  };
}

export const events = createEmitter<WorldEvents>();
