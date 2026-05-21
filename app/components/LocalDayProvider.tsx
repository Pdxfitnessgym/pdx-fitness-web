"use client";
// Writes the client's local day-of-week into a CSS custom property on <html>
// so server-rendered pages can highlight "today" correctly regardless of timezone.
// Usage: mount once in the layout or any page. No props needed.
import { useEffect } from "react";

export function LocalDayProvider() {
  useEffect(() => {
    const dow = new Date().getDay(); // 0=Sun … 6=Sat, in device timezone
    document.documentElement.setAttribute("data-today-dow", String(dow));
  }, []);
  return null;
}
