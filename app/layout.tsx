import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Lienzo's own text. Only the chrome uses it (`font-ui`); designs keep their own fonts.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Lienzo",
  description: "Pages of screens on an infinite canvas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
