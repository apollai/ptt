import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Project Time Tracker",
  description: "Track daily project hours and overtime."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
