import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const APP_NAME = "Nexora Watch";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#09090D" },
      {
        name: "google-adsense-account",
        content: "ca-pub-4558868217074430",
      },
      { name: "description", content: "Sevdiklerinle aynı anda, aynı karede. Nexora Watch by LenstedReal." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Nexora Watch" },
      { property: "og:description", content: "Sevdiklerinle aynı anda, aynı karede. Nexora Watch by LenstedReal." },
      { property: "og:image", content: "https://nexora-watch1.vercel.app/branding/nexora-logo.jpg" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Nexora Watch" },
      { name: "twitter:description", content: "Sevdiklerinle aynı anda, aynı karede." },
      { name: "twitter:image", content: "https://nexora-watch1.vercel.app/branding/nexora-logo.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/jpeg", href: "/branding/nexora-logo.jpg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/branding/nexora-logo.jpg" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const [client] = useState(() => new QueryClient());
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4558868217074430"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-surface text-on-surface antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={client}>
            <Outlet />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
