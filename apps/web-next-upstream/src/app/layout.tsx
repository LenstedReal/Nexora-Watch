import type { Metadata, Viewport } from "next";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Providers } from "./providers";
import "@/styles.css";

const APP_NAME = "Nexora Watch";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Sevdiklerinle aynı anda, aynı karede. Nexora Watch by LenstedReal.",
  other: {
    "google-adsense-account": "ca-pub-4558868217074430",
  },
  manifest: "/__grok/manifest.webmanifest",
  icons: {
    icon: "/branding/nexora-logo.jpg",
    apple: "/__grok/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4558868217074430"
          crossOrigin="anonymous"
        />
        <script async src="https://grok.com/grok-app-builder/extensions.js" />
      </head>
      <body className="bg-surface text-on-surface antialiased">
        <PreviewHostBridge />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
