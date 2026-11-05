/*
 * Boot: decides the view mode and the quality tier before first paint
 * (overview § 8). src/layouts/Base.astro inlines this file, synchronously, at
 * the top of <head>, with comments and indentation stripped (see inline.ts).
 * It must stay under 3 KB after stripping, and must never throw.
 *
 * Always sets window.__ashBoot = { mode, tier, reason, lang }.
 * In world mode it also adds the class `world-mode` to <html>.
 *
 * reason is one of: "url" (?view=), "saved" (localStorage['ash.view']),
 * "no webgl2", "software renderer", "save data", "low-end device" (automatic
 * picks of classic), "auto" (automatic pick of world), or "error".
 */
(function () {
  var w = window;
  var d = document.documentElement;
  var n = navigator;
  var boot = {
    mode: "classic",
    tier: "high",
    reason: "error",
    lang: d.lang === "ja" ? "ja" : "en",
  };
  w.__ashBoot = boot;

  // Automatic detection: the reason to pick classic, or "auto" for world.
  function detectMode() {
    var gl = null;
    var r = "";
    var ext;
    try {
      gl = document.createElement("canvas").getContext("webgl2");
    } catch (e) {}
    if (!gl) return "no webgl2";
    try {
      r = String(gl.getParameter(gl.RENDERER));
      // Chrome and Safari mask RENDERER; only then ask the debug extension
      // (Firefox already unmasks RENDERER and warns about the extension).
      if (/^webkit webgl$/i.test(r)) {
        ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      }
      ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    } catch (e) {}
    if (/swiftshader|llvmpipe|software/i.test(r)) return "software renderer";
    if (n.connection && n.connection.saveData) return "save data";
    // Both must be reported and low (comparisons with undefined are false).
    if (n.hardwareConcurrency < 4 && n.deviceMemory < 4)
      return "low-end device";
    return "auto";
  }

  function detectTier() {
    var s = w.screen;
    var coarse = !!(w.matchMedia && w.matchMedia("(pointer: coarse)").matches);
    var shortSide = s ? Math.min(s.width, s.height) : 1e4;
    return coarse || n.deviceMemory < 8 || shortSide < 700 ? "low" : "high";
  }

  try {
    var q = new URLSearchParams(w.location.search);
    var view = q.get("view");
    var tier = q.get("tier");
    var saved = null;
    if (view === "classic" || view === "world") {
      boot.mode = view;
      boot.reason = "url";
    } else {
      try {
        saved = w.localStorage.getItem("ash.view");
      } catch (e) {}
      if (saved === "classic" || saved === "world") {
        boot.mode = saved;
        boot.reason = "saved";
      } else {
        boot.reason = detectMode();
        boot.mode = boot.reason === "auto" ? "world" : "classic";
      }
    }
    boot.tier = tier === "high" || tier === "low" ? tier : detectTier();
  } catch (e) {
    boot.mode = "classic";
    boot.reason = "error";
  }
  if (boot.mode === "world") d.classList.add("world-mode");
})();
