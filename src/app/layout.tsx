import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com'

export const metadata: Metadata = {
  title: {
    default: 'Temuulel Commerce - AI-Powered E-commerce Platform',
    template: '%s | Temuulel Commerce',
  },
  description: 'Таны онлайн бизнесийг 24/7 ухаалаг туслахаар автоматжуулна. Хэрэглэгч бүрт хүрч ажиллана.',
  metadataBase: new URL(siteUrl),
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Temuulel Commerce - AI-Powered E-commerce Platform',
    description: 'Таны онлайн бизнесийг 24/7 ухаалаг туслахаар автоматжуулна. Хэрэглэгч бүрт хүрч ажиллана.',
    url: siteUrl,
    siteName: 'Temuulel Commerce',
    locale: 'mn_MN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temuulel Commerce - AI-Powered E-commerce Platform',
    description: 'Таны онлайн бизнесийг 24/7 ухаалаг туслахаар автоматжуулна.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-900`}
      >
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f1f5f9',
            },
          }}
        />
      </body>
    </html>
  );
}
