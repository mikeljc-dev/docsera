// Reveal-on-scroll sin dependencias: los elementos .reveal entran con un
// fade-up cuando asoman al viewport. Solo se activa si hay JS (clase "js"
// en <html>) — sin JS todo es visible — y prefers-reduced-motion lo
// desactiva por CSS.

export function initReveal(): void {
  document.documentElement.classList.add("js");

  const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
  if (elements.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    for (const el of elements) el.classList.add("visible");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
  );

  for (const el of elements) observer.observe(el);
}
