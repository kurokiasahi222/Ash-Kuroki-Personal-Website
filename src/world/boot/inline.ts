import raw from "./head.js?raw";

/** Hard limit for the inline boot script (WP-01 step 6). */
export const HEAD_SCRIPT_MAX_BYTES = 3 * 1024;

/**
 * `head.js` ready to inline into `<head>`: comments, indentation and blank
 * lines removed. head.js only uses full-line `//` comments and `/* *\/`
 * blocks, and ends every statement with a semicolon, so this is safe.
 */
export const headScript = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "")
  .replace(/^[ \t]+|[ \t]+$/gm, "")
  .replace(/\n{2,}/g, "\n")
  .trim();

const size = new TextEncoder().encode(headScript).length;
if (size > HEAD_SCRIPT_MAX_BYTES) {
  throw new Error(
    `Inline boot script is ${size} bytes; the limit is ${HEAD_SCRIPT_MAX_BYTES}.`,
  );
}
