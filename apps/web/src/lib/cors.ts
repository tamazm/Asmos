export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function corsJson(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...init?.headers },
  });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
