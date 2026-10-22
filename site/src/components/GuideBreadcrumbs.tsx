import { guideBreadcrumbs } from "../pages/guide-breadcrumbs";
import { Link } from "../router";

export function GuideBreadcrumbs({ path, navigate }: { path: string; navigate: (to: string) => void }) {
  const items = guideBreadcrumbs(path);
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm leading-6">
      <ol className="flex flex-wrap items-center gap-x-2 text-[var(--fg-dim)]">
        {items.map((item, index) => (
          <li key={item.path} className="flex min-w-0 items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === items.length - 1
              ? <span aria-current="page" className="py-2">{item.name}</span>
              : <Link to={item.path} onNavigate={navigate} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">{item.name}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
