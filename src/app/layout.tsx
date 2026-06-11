import type { Metadata } from "next";
import { ThemeProvider } from "@mind-studio/ui";
import { mind } from "@mind-studio/ui/themes";
import "./globals.css";
import Header from "@/components/Header";
import { StandaloneOnly } from "@/components/StandaloneOnly";
import { BrokerThemeSync } from "@/components/BrokerThemeSync";

export const metadata: Metadata = {
  title: "Mind Notes — your notes, in your pod",
  description:
    "A calm, text-first markdown notes app built on Solid Pods. Every note is a plain .md file in your pod.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-mind-theme="mind" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <ThemeProvider
          theme={mind}
          defaultTheme="dark"
          enableSystem={false}
          storageKey="mind-notes-theme"
        >
          <BrokerThemeSync />
          <StandaloneOnly>
            <Header />
          </StandaloneOnly>
          <main className="flex flex-1 flex-col">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
