// get-ais-jwt-and-connect.js
const API = 'http://localhost:8080'; // or 'http://127.0.0.1:8080' — be consistent with your CORS_ORIGINS

export async function openAisSSE(baseUrl = API, onMessage) {
  const r = await fetch(`${baseUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub: 'cesium-client' })
  });
  if (!r.ok) throw new Error(`auth/guest failed: ${r.status}`);
  const { token } = await r.json();

  // EventSource can't set headers, so pass the JWT in the URL
  const es = new EventSource(`${baseUrl}/sse/ais?token=${encodeURIComponent(token)}`);
  es.onmessage = (evt) => onMessage?.(JSON.parse(evt.data));
  es.onerror = (e) => console.warn('SSE error (auto-reconnect will kick in):', e);

  return { token, es };
}

