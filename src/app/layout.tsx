import type { Metadata, Viewport } from "next";
// Fonts are bundled with the app (Fontsource), so the build and the page
// never call Google Fonts. Latin subsets only, in the weights the UI uses.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-sans-condensed/latin-500.css";
import "@fontsource/ibm-plex-sans-condensed/latin-600.css";
import "@fontsource/ibm-plex-sans-condensed/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
//
// IBM Plex Sans — interface text. IBM Plex Mono — code, logs and tool output.
// IBM Plex Sans Condensed — page titles and headings.
// ─────────────────────────────────────────────────────────────────────────────

// Font families are set as CSS variables in globals.css (--font-sans,
// --font-display, --font-mono).

// ─────────────────────────────────────────────────────────────────────────────
// Viewport
// Must be a separate named export in Next.js 14+ (cannot live inside metadata)
// ─────────────────────────────────────────────────────────────────────────────

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#080A0C" },
    { media: "(prefers-color-scheme: light)", color: "#080A0C" },
  ],
  colorScheme: "dark",
};

// ─────────────────────────────────────────────────────────────────────────────
// Site constants — single source of truth for URLs and brand strings
// ─────────────────────────────────────────────────────────────────────────────

const SITE_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "https://ciphersuite.app";
const SITE_NAME = "CipherSuite";
const COMPANY   = "Alcyone Secure";
const TAGLINE   = "Professional Cybersecurity Workspace by Alcyone Secure";
const DESC      =
  "A structured operational workspace for penetration testers, bug bounty " +
  "hunters, and security researchers. Document findings, manage evidence, " +
  "analyze logs, and generate professional client reports — all in one place.";

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  `${SITE_NAME} · ${TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },

  description: DESC,

  applicationName: SITE_NAME,

  authors: [
    { name: COMPANY,   url: SITE_URL          },
    { name: SITE_NAME, url: SITE_URL          },
  ],
  creator:   COMPANY,
  publisher: COMPANY,

  keywords: [
    "cybersecurity workspace",
    "penetration testing tool",
    "pentest report generator",
    "bug bounty management",
    "vulnerability tracking",
    "security findings management",
    "SOC analyst tool",
    "security research workspace",
    "alcyone secure",
    "ciphersuite",
  ],

  /*
   * Intentionally de-indexed. CipherSuite is an operational security tool —
   * it should not appear in public search results.
   */
  robots: {
    index:     false,
    follow:    false,
    googleBot: { index: false, follow: false },
  },

  icons: {
    icon: [
      { url: "/favicon.ico",      sizes: "any"           },
      { url: "/favicon-32x32.png",sizes: "32x32"         },
      { url: "/favicon-16x16.png",sizes: "16x16"         },
    ],
    apple:   "/apple-touch-icon.png",
    shortcut:"/favicon-16x16.png",
  },

  manifest: "/manifest.json",

  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         SITE_URL,
    siteName:    SITE_NAME,
    title:       `${SITE_NAME} — ${TAGLINE}`,
    description: DESC,
    images: [
      {
        url:    "/og-image.png",
        width:  1200,
        height: 630,
        alt:    `${SITE_NAME} — ${TAGLINE}`,
      },
    ],
  },

  twitter: {
    card:        "summary_large_image",
    title:       `${SITE_NAME} — ${TAGLINE}`,
    description: DESC,
    images:      ["/og-image.png"],
  },

  // Prevents MIME-type sniffing — belt-and-suspenders server hardening
  other: {
    "X-Content-Type-Options": "nosniff",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Root layout
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={cn(
        // Always dark — this is a dark-only product
        "dark",
      )}
      // Required to suppress the React hydration warning caused by
      // browser extensions (e.g. 1Password, Grammarly) that modify the DOM
      suppressHydrationWarning
    >

      <body
        className={cn(
          // Layout
          "min-h-screen overflow-x-hidden",
          // Background — matches --background CSS var in globals.css
          "bg-[#080A0C]",
          // Typography
          "font-sans antialiased text-slate-100",
          // iOS font size inflation prevention
          "[-webkit-text-size-adjust:100%] [text-size-adjust:100%]",
          // Global text selection colour
          "selection:bg-violet-500/20 selection:text-violet-100",
        )}
      >
        <AuthProvider>
          <FirebaseErrorListener />
          <div className="relative isolate flex min-h-screen flex-col">
            {/* App content */}
            {children}
          </div>

          {/*
           * Global toast notifications.
           * Rendered outside the layout shell so toasts are never clipped
           * by overflow:hidden containers deeper in the tree.
           */}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
