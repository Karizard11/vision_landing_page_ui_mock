import { dorisUpstream } from "@/lib/doris-upstream";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null) {
  if (!value || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const from = incoming.searchParams.get("from");
  const to = incoming.searchParams.get("to");
  if (!validDate(from) || !validDate(to)) {
    return Response.json({ error: "from and to must be valid YYYY-MM-DD dates" }, { status: 400 });
  }

  const upstream = dorisUpstream("api/precool");
  upstream.searchParams.set("from", from!);
  upstream.searchParams.set("to", to!);

  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "The private Doris data service is unavailable." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
