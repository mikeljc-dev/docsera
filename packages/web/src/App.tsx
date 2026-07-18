import { Demo } from "./components/Demo.js";
import { Features } from "./components/Features.js";
import { Footer } from "./components/Footer.js";
import { Hero } from "./components/Hero.js";
import { HowItWorks } from "./components/HowItWorks.js";
import { Nav } from "./components/Nav.js";

export function App() {
  return (
    <div class="wrap">
      <Nav />
      <Hero />
      <Features />
      <Demo />
      <HowItWorks />
      <Footer />
    </div>
  );
}
