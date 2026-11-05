// Controls hint (WP-07 step 5): from the start of `explore` until the
// character first moves or 10 s pass, once per visit. While frozen for a shot
// it stays up (no timer), so shots are repeatable.

import { useEffect, useState } from "react";
import { site } from "../../content/site";
import { runtime } from "../runtime";
import { useStore } from "../store";
import { useLang, useMediaQuery, useMotionMs, usePresence } from "./common";
import { KeysIcon, TapIcon } from "./icons";

/** How long the hint stays up if the character doesn't move. */
export const HINT_MS = 10_000;
/** Speed (m/s) that counts as the character having moved. */
const MOVED_SPEED = 0.1;

type HintState = "waiting" | "showing" | "done";

export function ControlsHint() {
  const phase = useStore((s) => s.phase);
  const lang = useLang();
  const ms = useMotionMs();
  const touch = useMediaQuery("(pointer: coarse)");
  const [state, setState] = useState<HintState>("waiting");

  useEffect(() => {
    if (state === "waiting" && phase === "explore") setState("showing");
    else if (state === "showing" && phase !== "explore") setState("done");
  }, [phase, state]);

  useEffect(() => {
    if (state !== "showing") return;
    const timer = runtime.debug.freeze
      ? undefined
      : setTimeout(() => setState("done"), HINT_MS);
    let frame = requestAnimationFrame(function check() {
      if (runtime.character.speed > MOVED_SPEED) {
        setState("done");
        return;
      }
      frame = requestAnimationFrame(check);
    });
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [state]);

  const { mounted, leaving } = usePresence(state === "showing", ms);
  if (!mounted) return null;

  return (
    <p
      className={leaving ? "ui-hint ui-glass is-leaving" : "ui-hint ui-glass"}
      lang={lang}
      data-touch={touch || undefined}
    >
      {touch ? <TapIcon /> : <KeysIcon />}
      <span>
        {touch ? site.ui.controlsHintTouch[lang] : site.ui.controlsHint[lang]}
      </span>
    </p>
  );
}
