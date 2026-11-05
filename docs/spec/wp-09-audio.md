# WP-09: Audio

**Depends on:** WP-03 · **Branch:** `wp-09-audio` · **Wave:** 3
**Owns:** `src/world/audio/**`, `public/audio/**`

## Goal

A soft, rainy soundscape that only starts after the visitor chooses sound: rain, a distant city, positional sounds at the landmarks, and small one-shot effects tied to world events.

## Sound list

| id                          | Kind                                     | Where                    | Trigger                                                    |
| --------------------------- | ---------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `rain`                      | Stereo loop                              | Everywhere on the street | Always                                                     |
| `city`                      | Stereo loop, quiet                       | Everywhere on the street | Always                                                     |
| `train_far`                 | One-shot                                 | Distant, panned          | Every 40–90 s (seeded)                                     |
| `umbrella`                  | Loop, very quiet                         | Follows the character    | Always on the street                                       |
| `vending_hum`               | Positional loop                          | `SND_vending_hum`        | Always                                                     |
| `konbini`                   | Positional loop (muffled store ambience) | `SND_konbini`            | Always                                                     |
| `door_chime`                | One-shot                                 | `SND_konbini`            | `door` `{open:true}`                                       |
| `vending_beep`, `can_clunk` | One-shots, positional                    | `SND_vending_hum`        | `interact` `vending`: beep now, clunk after 0.8 s          |
| `bell`                      | Positional one-shot, about 6 s decay     | `SND_bell`               | `interact` `bell`                                          |
| `footstep_wet` ×4 variants  | One-shot                                 | The character            | `footstep`, with random variant, pitch ±5% and volume ±10% |
| `elevator`                  | One-shot                                 | 2D                       | `deck` `enter`                                             |
| `deck_ambience`             | Stereo loop (muffled rain on glass)      | 2D                       | Replaces `rain` and `city` while in phase `deck`           |
| `ui_tick`                   | One-shot                                 | 2D                       | `uiClick`                                                  |

## Steps

1. **Sources.**
   - Use only CC0 recordings, or sounds you generate yourself (for example synthesized with Python/NumPy, then encoded). Use a generic two-tone chime, never a real store's melody.
   - Record every file in `public/audio/CREDITS.md`: file, source URL or "generated", author and license.
   - Done when every id in the table has a file and a credit.
2. **Encoding.**
   - MP3. Positional sounds mono at 96 kbps; beds stereo at 128 kbps.
   - Loops must be seamless: crossfade-trim them and check that the join doesn't click.
   - **The total is at most 1.5 MB.**
3. **Engine.**
   - A `three` `AudioListener` on the camera, `PositionalAudio` at `registry.sounds`, and plain `Audio` for 2D sounds.
   - Load sounds only after the title card's Enter, and create or resume the `AudioContext` only from that click or from the sound toggle.
   - `store.sound` fades the master volume in or out over 0.4 s. Pause everything when `document.hidden`.
   - Done when nothing makes a sound, and no `AudioContext` is running, before the visitor opts in.
4. **Wiring.** Subscribe to the events in overview § 6.5 per the table. Swap the street beds and `deck_ambience` on `deck` `enter` and `exit`, crossfading over 1 s.
5. **Mix.**
   - Rain is the bed at about −18 LUFS. Everything else sits under it; the bell is the loudest one-shot.
   - Positional sounds fade with distance, with a reference distance of 3 m and a rolloff of 1.5.

## Acceptance

- [ ] `npm run check` passes. `npm run budget` shows audio at or under 1.5 MB.
- [ ] Playwright:
  - After **Enter muted**, the `AudioContext` doesn't exist or is `suspended`.
  - After **Enter with sound**, it is `running` and the listener is attached to the camera.
  - The sound toggle flips the master volume.
- [ ] Every file is listed in `CREDITS.md` with a CC0 or "generated" license.
- [ ] The PR notes for Ash what to listen for on the preview deployment: the bell, the vending machine, the footsteps and the deck swap. Containers can't hear.
