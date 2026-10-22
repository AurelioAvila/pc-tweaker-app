/**
 * The reference section (/tweaks, /database, /tools and the /fixes index)
 * carries the whole tweak catalogue and the Windows database, which most
 * visitors never open. It is a separate chunk: the server render imports it
 * directly (entry-server.tsx), and the browser loads it before hydrating one
 * of its pages (main.tsx) or before navigating to one (router.tsx).
 */
type ReferenceModule = typeof import("./pages/reference");

let loaded: ReferenceModule | null = null;

export const isReferencePath = (path: string) => /^\/(tweaks|database|tools)(\/|$)|^\/fixes\/?$/.test(path);

export const referenceModule = () => loaded;

export function setReferenceModule(module: ReferenceModule) {
  loaded = module;
}

export async function loadReference(): Promise<ReferenceModule> {
  loaded ??= await import("./pages/reference");
  return loaded;
}
