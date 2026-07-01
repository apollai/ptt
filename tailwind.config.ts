import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        mist: "#eef2f3",
        line: "#d6dde1",
        paper: "#f8f9f6",
        moss: "#4f6f52",
        fern: "#72946b",
        clay: "#a65f49",
        blue: "#346f95"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 38, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
