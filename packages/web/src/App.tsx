import { Compare } from "./components/Compare.js";
import { CTA } from "./components/CTA.js";
import { Demo } from "./components/Demo.js";
import { Features } from "./components/Features.js";
import { Footer } from "./components/Footer.js";
import { Hero } from "./components/Hero.js";
import { HowItWorks } from "./components/HowItWorks.js";
import { Nav } from "./components/Nav.js";

export function App() {
  return (
    <>
      <Nav />
      <div class="wrap">
        <Hero />
        <Features />
        <Compare />
        <HowItWorks />
        <Demo />
        <CTA />
        <Footer />
      </div>
    </>
  );
}
