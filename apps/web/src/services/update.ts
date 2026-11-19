// Reload the app to pick up the latest version. Installed as an app there's no browser reload
// button, so Settings offers one. Edits are already saved, so nothing is lost.
export async function reloadApp() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    // Ask for a fresh service worker first, but don't hang the reload on a slow network.
    if (reg) await Promise.race([reg.update(), new Promise((resolve) => setTimeout(resolve, 1500))]);
  } catch {
    // Offline or unsupported: a plain reload still works from the cache.
  }
  location.reload();
}

/** When this version was built, e.g. "Nov 19". */
export const builtAt = new Date(__BUILT_AT__).toLocaleDateString(undefined, { month: "short", day: "numeric" });
