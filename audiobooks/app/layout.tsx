import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audiobook Suggester",
  description: "Get personalized audiobook recommendations based on your reading history",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
