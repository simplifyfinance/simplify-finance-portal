import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simplify Finance Portal",
  description: "Credit & Compliance Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
