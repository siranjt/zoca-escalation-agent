import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface ramp
        bg: "#0a0c0f",
        panel: "#10141a",
        panel2: "#171c23",
        panel3: "#1d232c",
        border: "#222831",
        border2: "#2c333d",
        muted: "#7e8794",
        muted2: "#9ba3ae",
        text: "#e7ecf2",
        text2: "#f4f7fa",

        // Brand (pink primary, blue secondary — matches zoca.com)
        brand: "#ffa8cd",
        brandDeep: "#ff7eb9",
        brandSoft: "#2a1820",
        cobalt: "#4d65ff",
        cobaltSoft: "#161a2f",
        // Semantic
        accent: "#5b8cff",
        accentSoft: "#1a2540",
        ok: "#3ecf8e",
        okSoft: "#0f2c20",
        warn: "#f5b656",
        warnSoft: "#322412",
        err: "#ef5b5b",
        errSoft: "#341818",

        // Classification ramp (matches preview)
        churn: "#e24b4a",
        churnBg: "#2a1212",
        retention: "#ef9f27",
        retentionBg: "#2c1c08",
        subSupport: "#378add",
        subSupportBg: "#101e2e",
        paidOff: "#7f77dd",
        paidOffBg: "#1a172e",
        subCancel: "#d4537e",
        subCancelBg: "#2a121d",

        // Channel ramp (timeline strips)
        chApp: "#5b8cff",
        chEmail: "#7f77dd",
        chPhone: "#3ecf8e",
        chVideo: "#d4537e",
        chSms: "#f5b656",
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
        // Slightly smaller defaults for denser dashboard feel
        xs: ["11px", "16px"],
        sm: ["13px", "20px"],
        base: ["14px", "22px"],
        lg: ["16px", "24px"],
        xl: ["18px", "26px"],
        "2xl": ["22px", "30px"],
        "3xl": ["26px", "32px"],
      },
    },
  },
  plugins: [],
};

export default config;
