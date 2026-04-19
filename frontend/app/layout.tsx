import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import TopNav from "@/components/TopNav";
import ChatPanel from "@/components/ChatPanel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {/*
           * Three-row layout (all inside a full-screen flex column):
           *   1. TopNav    — fixed height, always visible
           *   2. <main>    — flex-1, scrollable, fills remaining space
           *   3. ChatPanel — accordion docked at the bottom
           *
           * The ChatPanel header is always visible. Clicking it slides
           * the chat area open or closed above it.
           */}
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNav />
            <main
              className="flex-1 overflow-y-auto"
              style={{ backgroundColor: "var(--bg-base)" }}
            >
              <div className="max-w-[80%] mx-auto">
                {children}
              </div>
            </main>
            <ChatPanel />
          </div>
        </Providers>
      </body>
    </html>
  );
}
