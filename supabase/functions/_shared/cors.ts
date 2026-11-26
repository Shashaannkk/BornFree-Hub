function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGIN') ?? '';
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': parseAllowedOrigins()[0] ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function getCorsHeaders(req?: Request): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const reqOrigin = req?.headers?.get('origin')?.trim().replace(/\/+$/, '') || '';
  const isProd = (Deno.env.get('APP_ENV') || Deno.env.get('ENV') || '').toLowerCase() === 'production';

  let allowOrigin = '*';
  if (allowed.length > 0) {
    allowOrigin = allowed.includes(reqOrigin) ? reqOrigin : allowed[0];
  } else if (isProd) {
    allowOrigin = 'null';
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function jsonResponse(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}
