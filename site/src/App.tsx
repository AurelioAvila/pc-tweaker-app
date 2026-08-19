import { useEffect } from "react";
import { Nav } from "./components/Nav";
import { HeroSection } from "./components/HeroSection";
import { PerformanceMetrics } from "./components/PerformanceMetrics";
import { BespokeArsenal } from "./components/BespokeArsenal";
import { EngineeringPhilosophy } from "./components/EngineeringPhilosophy";
import { ProtocolTimeline } from "./components/ProtocolTimeline";
import { AccessPricing } from "./components/AccessPricing";
import { ReviewsSection } from "./components/ReviewsSection";
import { FaqAccordion } from "./components/FaqAccordion";
import { Footer } from "./components/Footer";
import { SupportPage } from "./pages/Support";
import { PrivacyPage, TermsPage, CookiesPage, AccessibilityPage, NotFoundPage } from "./pages/Legal";
import { useRoute } from "./router";

function HomePage() {
  return (
    <main id="main-content">
      <HeroSection />
      <PerformanceMetrics />
      <BespokeArsenal />
      <EngineeringPhilosophy />
      <ProtocolTimeline />
      <AccessPricing />
      <ReviewsSection />
      <FaqAccordion />
    </main>
  );
}

const HOME_TITLE = "PC Tweaker — Every Millisecond Is Earned";

/** Known routes and their tab titles. Anything else renders the 404 page —
 *  previously unknown paths silently showed the homepage, which meant a
 *  mistyped link looked like a working page instead of an error. */
const ROUTES: Record<string, { title: string }> = {
  "/": { title: HOME_TITLE },
  "/support": { title: "Support — PC Tweaker" },
  "/privacy": { title: "Privacy Policy — PC Tweaker" },
  "/terms": { title: "Terms of Service — PC Tweaker" },
  "/cookies": { title: "Cookie Policy — PC Tweaker" },
  "/accessibility": { title: "Accessibility — PC Tweaker" },
};

export default function App() {
  const { path, navigate } = useRoute();
  const route = ROUTES[path];

  // Client-side routing doesn't reload the document, so the tab title would
  // otherwise stay on whatever index.html shipped with.
  useEffect(() => {
    document.title = route ? route.title : "Page not found — PC Tweaker";
  }, [route]);

  let page: React.ReactNode;
  switch (path) {
    case "/":
      page = <HomePage />;
      break;
    case "/support":
      page = <SupportPage navigate={navigate} />;
      break;
    case "/privacy":
      page = <PrivacyPage />;
      break;
    case "/terms":
      page = <TermsPage />;
      break;
    case "/cookies":
      page = <CookiesPage />;
      break;
    case "/accessibility":
      page = <AccessibilityPage />;
      break;
    default:
      page = <NotFoundPage navigate={navigate} />;
  }

  return (
    <>
      {/* Visually hidden until focused: the first Tab press lets keyboard and
          screen-reader users jump past the nav straight to the content. */}
      <a
        href="#main-content"
        className="bg-accent sr-only z-[100] rounded-xl px-5 py-3 text-[14px] font-bold text-[var(--bg)] focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Nav navigate={navigate} onSupportPage={path === "/support"} />
      {page}
      <Footer navigate={navigate} />
    </>
  );
}
