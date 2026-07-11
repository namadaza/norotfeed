import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/lib/theme-context";
import { Analytics } from "@vercel/analytics/next"
import { getUserSession, getUserData } from "@/lib/db/user";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: "No Rot Feed",
  description: "Brain nourishment.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getUserSession();
  const userId = session?.user?.id;
  const colorTheme = userId ? (await getUserData({ id: userId })).themePreference ?? "default" : "default";

  return (
    <html lang="en" suppressHydrationWarning className={`theme-${colorTheme}`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <ThemeProvider
            defaultTheme="system"
            storageKey="norotfeed-theme"
            initialColorTheme={colorTheme}
          >
            {children}
          </ThemeProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}