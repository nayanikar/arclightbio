"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DevShortcut() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        router.push("/admin");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
