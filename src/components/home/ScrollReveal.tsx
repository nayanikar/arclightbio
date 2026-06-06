"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { fadeUp, viewportOnce } from "./homeMotion";
import { cn } from "@/lib/utils";

interface ScrollRevealProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Animate immediately on mount (for above-the-fold blocks) */
  immediate?: boolean;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  immediate = false,
  ...props
}: ScrollRevealProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inViewOnMount, setInViewOnMount] = useState(immediate);

  useLayoutEffect(() => {
    if (immediate || reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      setInViewOnMount(true);
    }
  }, [immediate, reduceMotion]);

  if (reduceMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  const shouldAnimateImmediately = immediate || inViewOnMount;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={shouldAnimateImmediately ? "visible" : undefined}
      whileInView={shouldAnimateImmediately ? undefined : "visible"}
      viewport={viewportOnce}
      variants={fadeUp}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
