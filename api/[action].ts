// Login con Google. Guarda el "refresh token" cifrado en una cookie para que
// la sesión quede abierta, y le entrega a la app tokens de acceso a Drive.

const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
const SESSION = 'facu_session';
const STATE = 'facu_state';
const MAX_AGE = 400 * 24 * 60 * 60;

type Session = { rt: string; user: { email: string; name: string; picture?: string } };

const enc = new TextEncoder();
const dec = new TextDecoder();

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable ${name} (ver LEEME.md)`);
  return v;
}

async function key() {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(env('SESSION_SECRET')));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(data: Session) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), enc.encode(JSON.stringify(data))),
  );
  return Buffer.concat([iv, ct]).toString('base64url');
}

async function unseal(value: string | null): Promise<Session | null> {
  if (!value) return null;
  try {
    const buf = new Uint8Array(Buffer.from(value, 'base64url'));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, await key(), buf.slice(12));
    return JSON.parse(dec.decode(pt));
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number, secure: boolean) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

function respond(status: number, body: unknown, cookies: string[] = [], location?: string) {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (location) headers.set('Location', location);
  else headers.set('Content-Type', 'application/json');
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(location ? null : JSON.stringify(body), { status, headers });
}

async function googleToken(params: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      ...params,
    }),
  });
  return { ok: r.ok, data: await r.json() };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();
  const secure = url.protocol === 'https:';
  const redirectUri = `${url.origin}/api/callback`;

  if (action === 'login') {
    const state = crypto.randomUUID();
    const p = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return respond(302, null, [cookie(STATE, state, 600, secure)], `https://accounts.google.com/o/oauth2/v2/auth?${p}`);
  }

  if (action === 'callback') {
    const clearState = cookie(STATE, '', 0, secure);
    if (url.searchParams.get('error')) return respond(302, null, [clearState], '/?error=cancelado');
    const state = url.searchParams.get('state');
    if (!state || state !== readCookie(req, STATE)) return respond(302, null, [clearState], '/?error=reintentar');

    const { ok, data } = await googleToken({
      code: url.searchParams.get('code') ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (!ok || !data.refresh_token) return respond(302, null, [clearState], '/?error=reintentar');
    if (!String(data.scope).includes('drive.file')) return respond(302, null, [clearState], '/?error=falta_drive');

    const claims = JSON.parse(Buffer.from(String(data.id_token).split('.')[1], 'base64url').toString());
    const session = await seal({
      rt: data.refresh_token,
      user: { email: claims.email, name: claims.name ?? claims.email, picture: claims.picture },
    });
    return respond(302, null, [clearState, cookie(SESSION, session, MAX_AGE, secure)], '/');
  }

  if (action === 'token') {
    const raw = readCookie(req, SESSION);
    const session = await unseal(raw);
    if (!session) return respond(401, { error: 'sin_sesion' });
    const { ok, data } = await googleToken({ refresh_token: session.rt, grant_type: 'refresh_token' });
    if (!ok) {
      const expired = data.error === 'invalid_grant';
      return respond(expired ? 401 : 502, { error: data.error }, expired ? [cookie(SESSION, '', 0, secure)] : []);
    }
    // Renueva la cookie para que la sesión no venza mientras se use la app.
    return respond(200, { access_token: data.access_token, expires_in: data.expires_in, user: session.user }, [
      cookie(SESSION, raw!, MAX_AGE, secure),
    ]);
  }

  if (action === 'logout') return respond(302, null, [cookie(SESSION, '', 0, secure)], '/');

  return respond(404, { error: 'no_existe' });
}
