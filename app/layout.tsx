import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precool Energy Operations",
  description: "Live operational performance for Terradew Four project P0480.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
