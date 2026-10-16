import { renderToString } from "react-dom/server";
import App from "./App";
import { ThemeProvider } from "./theme";
import { getRouteJsonLd, NOT_FOUND_SEO, ROUTE_JSONLD, ROUTE_SEO } from "./seo";

export function render(path: string): string {
  return renderToString(
    <ThemeProvider>
      <App initialPath={path} />
    </ThemeProvider>,
  );
}

export { getRouteJsonLd, NOT_FOUND_SEO, ROUTE_JSONLD, ROUTE_SEO };
