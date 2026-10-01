/**
 * Mount once in the root layout so the Grok preview chrome can drive navigation.
 * Noops when the app is not embedded.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { installPreviewHostBridge } from "@/lib/preview-host-bridge";

export function PreviewHostBridge() {
  const router = useRouter();

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        router.push(path);
      },
      getRoutePaths: () => ["/", "/room/:code"],
    });
  }, [router]);

  return null;
}
