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
import { useRoute } from "./router";

function HomePage() {
  return (
    <main>
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
const SUPPORT_TITLE = "Support — PC Tweaker";

export default function App() {
  const { path, navigate } = useRoute();
  const isSupport = path === "/support";

  // Client-side routing doesn't reload the document, so the tab title would
  // otherwise stay on whatever index.html shipped with.
  useEffect(() => {
    document.title = isSupport ? SUPPORT_TITLE : HOME_TITLE;
  }, [isSupport]);

  return (
    <>
      <Nav navigate={navigate} onSupportPage={isSupport} />
      {isSupport ? <SupportPage navigate={navigate} /> : <HomePage />}
      <Footer navigate={navigate} />
    </>
  );
}
