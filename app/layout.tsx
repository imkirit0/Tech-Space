import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Doto } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dot-matrix face for the token board's LED numerals only.
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["900"],
});

export const metadata: Metadata = {
  title: {
    default: "Activity Reporting — G-TEC",
    template: "%s — Activity Reporting",
  },
  description: "G-TEC internal employee activity reporting system",
};

export const viewport: Viewport = {
  themeColor: "#002b55",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} h-full antialiased`}
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before hydration. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
        <Toaster theme="light" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
