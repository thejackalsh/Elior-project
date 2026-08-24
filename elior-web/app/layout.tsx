import type { Metadata } from "next";
import { Orbitron, Space_Grotesk, Libre_Baskerville } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const telma = localFont({
  src: "./fonts/Telma-Medium.woff2",
  variable: "--font-telma",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elior",
  description:
    "Aplikasi teknologi asistif berbasis AI untuk pengguna tunanetra. Deskripsi objek, pembacaan teks OCR, dan deteksi uang Rupiah.",
  icons: {
    icon: "/faviconv2.png",
    apple: "/faviconv2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${orbitron.variable} ${spaceGrotesk.variable} ${libreBaskerville.variable} ${telma.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
