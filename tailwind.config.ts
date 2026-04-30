import type { Config } from "tailwindcss";

// Light theme tokens — matches Zoca's Performance Report Generator aesthetic.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: "#fafbfc",
        panel: "#ffffff",
        panel2: "#f7f8fb",
        panel3: "#f0f1f5",
        border: "#e5e7eb",
        border2: "#d8dde6",
        // Text
        text: "#0d1117",
        text2: "#1f2937",
        muted: "#838d9d",
        muted2: "#5a6371",
        // Brand (zoca.com)
        brand: "#ff5aa0",
        brandDeep: "#ff3d8a",
        brandSoft: "#fff5fa",
        cobalt: "#3b5bff",
        cobaltSoft: "#eef2ff",
        violet: "#8b4dff",
        violetSoft: "#f3eefc",
        // Semantic (light theme variants)
        accent: "#3b5bff",
        accentSoft: "#eef2ff",
        ok: "#15803d",
        okSoft: "#e6f7ec",
        warn: "#92400e",
        warnSoft: "#fffbeb",
        err: "#b91c1c",
        errSoft: "#fef2f2",
        // Channel ramp (timeline strips, donut)
        chApp: "#3b5bff",
        chEmail: "#8b4dff",
        chPhone: "#22c55e",
        chVideo: "#eab308",
        chSms: "#ff5aa0",
        // Classification ramp
        churn: "#ef4444",
        retention: "#f59e0b",
        subSupport: "#3b5bff",
        paidOff: "#8b4dff",
        subCancel: "#ff5aa0",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Montserrat", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "14px",
        "2xl": "16px",
      },
      fontSize: {
        xs: ["11px", "16px"],
        sm: ["13px", "20px"],
        base: ["14px", "22px"],
        lg: ["16px", "24px"],
        xl: ["18px", "26px"],
        "2xl": ["22px", "30px"],
        "3xl": ["28px", "34px"],
        "4xl": ["38px", "1.05"],
        "5xl": ["56px", "1.05"],
      },
    },
  },
  plugins: [],
};

export default config;
