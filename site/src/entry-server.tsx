import { renderToString } from "react-dom/server";
import App from "./App";
import { ThemeProvider } from "./theme";
import { getRouteImage, getRouteJsonLd, NOT_FOUND_SEO, ROUTE_JSONLD, ROUTE_SEO } from "./seo";

export function render(path: string): string {
  return renderToString(
    <ThemeProvider>
      <App initialPath={path} />
    </ThemeProvider>,
  );
}

export { getRouteImage, getRouteJsonLd, NOT_FOUND_SEO, ROUTE_JSONLD, ROUTE_SEO };
export { INVITATION_SEO } from "./pages/Invitation";
