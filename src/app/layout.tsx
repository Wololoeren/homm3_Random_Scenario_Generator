import type { Metadata } from "next";
import "./globals.css";
import { asset } from "@/lib/assets";

/**
 * Rules that reference files in /public. They live here rather than in
 * globals.css because a stylesheet cannot see the GitHub Pages base path, and
 * a relative url() would depend on where Next happens to emit the CSS.
 */
const assetStyles = `
@font-face {
  font-family: "Liberation Serif";
  src: url("${asset("/fonts/LiberationSerif-Regular.woff2")}") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Liberation Serif";
  src: url("${asset("/fonts/LiberationSerif-Bold.woff2")}") format("woff2");
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Liberation Serif";
  src: url("${asset("/fonts/LiberationSerif-Italic.woff2")}") format("woff2");
  font-weight: normal;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: "Liberation Serif";
  src: url("${asset("/fonts/LiberationSerif-BoldItalic.woff2")}") format("woff2");
  font-weight: bold;
  font-style: italic;
  font-display: swap;
}
.reference li {
  background-image: url("${asset("/layout/listdot.webp")}");
}
`;

export const metadata: Metadata = {
  title: "HoMM3 BG — Random Scenario Generator",
  description:
    "Generate printable random cooperative and clash scenarios for Heroes of Might & Magic III: The Board Game.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: assetStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
