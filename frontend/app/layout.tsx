import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import TopNav from "@/components/TopNav";
import ChatRail from "@/components/ChatRail";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MarketMind",
  description: "AI-powered finance dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-temp="neutral" data-accent="ink" suppressHydrationWarning>
      <body className={`${inter.variable} ${serif.variable} ${mono.variable} antialiased`}>
        <Providers>
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNav />
            <div className="flex flex-1 overflow-hidden">
              <main
                className="flex-1 overflow-y-auto"
                style={{ backgroundColor: "var(--bg-page)" }}
              >
                {children}
              </main>
              <ChatRail />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
