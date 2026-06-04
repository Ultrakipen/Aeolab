"use client";
import { useEffect } from "react";

export default function LandingScrollAnimation() {
  useEffect(() => {
    document.body.classList.add("js-anim");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    requestAnimationFrame(() => {
      document.querySelectorAll(".fade-up, .slide-left, .slide-right").forEach((el) => io.observe(el));
    });

    return () => {
      document.body.classList.remove("js-anim");
      io.disconnect();
    };
  }, []);

  return null;
}
