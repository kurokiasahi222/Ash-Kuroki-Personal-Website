// Minimal argv parser: `--key value`, `--key=value`, `--flag`, `--no-flag`.
// Positional arguments are collected in `_`.

/**
 * @param {string[]} argv
 * @param {{ boolean?: string[] }} [spec] names that never take a value
 * @returns {Record<string, string | boolean | string[]> & { _: string[] }}
 */
export function parseArgs(argv, spec = {}) {
  const booleans = new Set(spec.boolean ?? []);
  /** @type {Record<string, any>} */
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const key = arg.slice(2, eq === -1 ? undefined : eq);
    if (eq !== -1) {
      out[key] = arg.slice(eq + 1);
    } else if (key.startsWith("no-")) {
      out[key] = true; // keep "--no-js" readable as args["no-js"]
      out[key.slice(3)] = false;
    } else if (
      booleans.has(key) ||
      i + 1 >= argv.length ||
      argv[i + 1].startsWith("--")
    ) {
      out[key] = true;
    } else {
      out[key] = argv[++i];
    }
  }
  return out;
}
