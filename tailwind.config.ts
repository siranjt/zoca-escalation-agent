import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#14181d",
        panel2: "#1b2027",
        border: "#262c34",
        muted: "#8a93a0",
        text: "#e7ecf2",
        accent: "#4f8cff",
        ok: "#3ecf8e",
        warn: "#f7b955",
        err: "#ef5b5b",
      },
    },
  },
  plugins: [],
};

export default config;
