import type { Metadata } from "next";
import Script from "next/script";
import { Outfit, Syne } from "next/font/google";
import { SiteChrome } from "@/components/SiteChrome";
import { VantaBackground } from "@/components/VantaBackground";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jhaycee Anthony Acain — Computer Engineer",
  description:
    "Portfolio of Jhaycee Anthony Acain, Master of Science in Computer Engineering Candidate - Major in Digital Hardware Systems at the University of San Carlos.",
};

const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${syne.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="relative min-h-full font-sans text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <VantaBackground />
        <div className="relative z-10">
          <a href="#content" className="skip-link">
            Skip to content
          </a>
          <SiteChrome>{children}</SiteChrome>
        </div>
      </body>
    </html>
  );
}
