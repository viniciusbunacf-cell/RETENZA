import localFont from "next/font/local";

// Tipografia da marca (arquivos em src/fonts, licença SIL Open Font License 1.1).
// Sora: títulos, números de destaque e o nome da marca. Figtree: texto e interface.
export const sora = localFont({
  src: [
    { path: "../fonts/Sora-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Sora-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
});

export const figtree = localFont({
  src: [
    { path: "../fonts/Figtree-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Figtree-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Figtree-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Figtree-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-figtree",
  display: "swap",
});
