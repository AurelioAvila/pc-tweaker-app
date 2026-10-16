import { DIRECTORY_GUIDES } from "./guide-directory";

export function guideBreadcrumbs(path: string): readonly { name: string; path: string }[] {
  const guide = DIRECTORY_GUIDES.find((entry) => entry.path.replace(/\/$/, "") === path);
  if (path !== "/guides" && !guide) return [];
  return [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides/" },
    ...(guide ? [{ name: guide.title, path: guide.path }] : []),
  ];
}
