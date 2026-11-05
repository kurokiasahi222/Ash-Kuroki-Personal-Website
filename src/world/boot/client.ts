// The page's only module script, loaded in both view modes. It must stay tiny
// and must never import the 3D app statically: Classic mode downloads this
// file and nothing else from src/world/.

// React Fast Refresh needs its preamble before any component module runs.
// Astro adds it only to pages with React islands, and we mount React
// ourselves, so load it here. Dev only: it's an empty module in builds.
import "@vitejs/plugin-react/preamble";
import { fallbackToClassic } from "./fallback";

const VIEW_KEY = "ash.view";

// "Enter the 3D world" / "Classic view" links carry data-view-choice. Clicking
// one saves the choice (overview § 8); the link's ?view= does the rest.
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest<HTMLAnchorElement>("a[data-view-choice]");
  const choice = link?.dataset.viewChoice;
  if (choice !== "world" && choice !== "classic") return;
  try {
    localStorage.setItem(VIEW_KEY, choice);
  } catch {
    // storage blocked: the URL parameter still applies to this visit
  }
});

// Keep an explicit ?view= when switching language from the Classic header.
const view = new URLSearchParams(location.search).get("view");
if (view === "world" || view === "classic") {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    "a[data-lang-link]",
  )) {
    const url = new URL(link.href, location.href);
    url.searchParams.set("view", view);
    link.href = url.pathname + url.search + url.hash;
  }
}

if (window.__ashBoot?.mode === "world") {
  const el = document.getElementById("world-root");
  if (!el) {
    fallbackToClassic("#world-root is missing");
  } else {
    import("./mount")
      .then(({ mount }) => mount(el))
      .catch((error: unknown) =>
        fallbackToClassic("could not load the 3D world", error),
      );
  }
}
