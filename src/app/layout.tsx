import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

// NOTE: We intentionally do NOT use next/font/google here. That module
// downloads font files from Google's servers at BUILD TIME. On deploy
// platforms with restricted network access (common in CI/CD), the download
// fails and crashes the build with "Sorry, there was a problem deploying
// the code." We use system font stacks instead — zero network dependency.
const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

export const metadata: Metadata = {
  title: "VANGUARD OPS — Browser FPS",
  description: "A browser-based 3D FPS with FFA, TDM, Kill Confirmed, Gun Game and Survival, bots & online play, weapon unlocks, attachments and skins.",
  keywords: ["FPS", "browser game", "Three.js", "multiplayer", "Vanguard Ops"],
  authors: [{ name: "Z.ai" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" duration={3200} visibleToasts={5} gap={10} expand={true} richColors closeButton={false} />
      </body>
    </html>
  );
}
