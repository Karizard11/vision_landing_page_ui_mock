import { dorisUpstream } from "@/lib/doris-upstream";

export async function GET() {
  const upstream = dorisUpstream("api/contracts");
  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return Response.json({ error: "The private Doris contract service is unavailable." }, { status: 502 });
  }
}
