import { renderToString } from "react-dom/server";
import App from "./App";
import { ThemeProvider } from "./theme";
import { getRouteImage, getRouteJsonLd, NOT_FOUND_SEO, ROUTE_JSONLD as BASE_JSONLD, ROUTE_SEO as BASE_SEO } from "./seo";
import * as Reference from "./pages/reference";
import { setReferenceModule } from "./reference-registry";

// The server render has the reference chunk in hand from the start.
setReferenceModule(Reference);

const ROUTE_SEO = { ...BASE_SEO, ...Reference.REFERENCE_SEO };
const ROUTE_JSONLD = { ...BASE_JSONLD, ...Reference.REFERENCE_JSONLD };
const OG_CARDS = Reference.ogCards();

export function render(path: string): string {
  return renderToString(
    <ThemeProvider>
      <App initialPath={path} />
    </ThemeProvider>,
  );
}

export { getRouteImage, getRouteJsonLd, NOT_FOUND_SEO, OG_CARDS, ROUTE_JSONLD, ROUTE_SEO };
export { INVITATION_SEO } from "./pages/Invitation";
