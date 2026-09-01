const loadedScripts = new Map<string, Promise<void>>();

/**
 * Idempotently load an external script. The tag is appended imperatively so
 * React never owns it — re-renders and navigation cannot re-execute it.
 */
export default function loadScriptOnce(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) {
    return existing;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      loadedScripts.delete(src);
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    });
    document.head.append(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}
