// src/components/theme-initializer.tsx
"use client";
import { useEffect } from 'react';

export default function ThemeInitializer() {
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
      if (!storedTheme) {
        localStorage.setItem('theme', 'dark'); // Persist if based on system preference and not set
      }
    } else {
      document.documentElement.classList.remove('dark');
      if (!storedTheme) {
        localStorage.setItem('theme', 'light'); // Persist if based on system preference and not set
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount

  return null; // This component does not render anything visible
}
