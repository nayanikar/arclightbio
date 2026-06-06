"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, staggerContainer } from "./homeMotion";
import { cn } from "@/lib/utils";

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  animateOnMount?: boolean;
}

export function StaggerChildren({
  children,
  className,
  animateOnMount = false,
}: StaggerChildrenProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate={animateOnMount && !reduceMotion ? "visible" : undefined}
      whileInView={animateOnMount || reduceMotion ? undefined : "visible"}
      viewport={animateOnMount ? undefined : { once: true }}
      variants={staggerContainer}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={reduceMotion ? undefined : fadeUp}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
