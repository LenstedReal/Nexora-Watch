"use client";

import { TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-surface text-on-surface">
      <TriangleAlert className="size-10 text-error" />
      <h1 className="font-display text-lg font-semibold">Bir şeyler ters gitti</h1>
      <p className="max-w-md text-sm text-muted break-words">
        {error.message || "Beklenmeyen bir hata oluştu."}
      </p>
    </main>
  );
}
