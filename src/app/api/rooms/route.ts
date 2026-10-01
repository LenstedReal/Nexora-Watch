import { createRoom } from "@/lib/nexora/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createRoom(body?.nickname, body?.name);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[POST /api/rooms]", error);
    return Response.json(
      { detail: "Oda oluşturulurken sunucu hatası oluştu" },
      { status: 500 },
    );
  }
}
