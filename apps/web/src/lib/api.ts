const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');

// Artificial delay (ms) applied to GET requests so loading skeletons are
// visible. Configure via NEXT_PUBLIC_API_DELAY_MS; set to 0 to disable.
const rawDelay = process.env.NEXT_PUBLIC_API_DELAY_MS;
const API_DELAY_MS =
  rawDelay != null && rawDelay !== '' ? Number(rawDelay) : 800;

export function apiBaseUrl() {
  return API_URL;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const auth =
    token ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('lms_token')
      : null) ??
    'dev-admin-token';

  const method = (rest.method ?? 'GET').toUpperCase();
  if (method === 'GET' && API_DELAY_MS > 0) {
    await sleep(API_DELAY_MS);
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth}`,
      ...headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(json.message)) message = json.message.join(', ');
      else if (json.message) message = json.message;
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
