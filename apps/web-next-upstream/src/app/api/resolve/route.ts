import { resolveVideoSource } from "@/lib/nexora/video";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url || url.length > 8000) {
      return Response.json(
        { ok: false, error: "Geçerli bir video adresi gerekli" },
        { status: 400 },
      );
    }

    const resolved = await resolveVideoSource(url);

    if (resolved.kind === "web") {
      return Response.json(
        {
          ok: false,
          error:
            "Bu adres video kaynağı değil. Web özelliği Google üzerinden açılır.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      source: {
        url: resolved.url,
        kind: resolved.kind,
        video_id: resolved.video_id,
        embed_url: resolved.embed_url,
        stream_url: resolved.stream_url,
        title: resolved.title,
        mime_type: resolved.mime_type,
        provider: resolved.provider,
        confidence: resolved.confidence,
        method: resolved.method,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Video kaynağı çözülemedi",
      },
      { status: 422 },
    );
  }
}
