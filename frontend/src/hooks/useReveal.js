import { useEffect, useRef } from "react";

/**
 * Scroll-triggered reveal for marketing sections.
 *
 * Fires once per element and then stops observing — content that re-animates
 * every time it scrolls past is the thing that makes a page feel cheap.
 * Users who ask for reduced motion get the finished state immediately.
 */
export function useReveal(rootRef, { selector = "[data-reveal]", stagger = 60 } = {}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const items = Array.from(root.querySelectorAll(selector));
    if (!items.length) return undefined;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.setAttribute("data-revealed", "true"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const siblings = entry.target.parentElement
            ? Array.from(entry.target.parentElement.children)
            : [];
          const index = Math.min(siblings.indexOf(entry.target), 5);
          entry.target.style.transitionDelay = `${Math.max(index, 0) * stagger}ms`;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" },
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootRef, selector, stagger]);
}

/** Convenience for a section that reveals as a whole. */
export function useRevealRef() {
  return useRef(null);
}
