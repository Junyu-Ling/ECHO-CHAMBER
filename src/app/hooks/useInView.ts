import { useEffect, useRef, useState } from "react";

export function useInView<T extends Element>(
  options?: IntersectionObserverInit & { rootMargin?: string }
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: options?.rootMargin ?? "200px 0px",
        threshold: options?.threshold ?? 0.01,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, inView };
}
