export function demoSession(request: Request) {
  const retained = (request.headers.get("cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith("normal_demo_session="))?.slice("normal_demo_session=".length);
  const valid = retained && /^[a-f0-9-]{36}$/.test(retained);
  return { id: valid ? retained : crypto.randomUUID(), isNew: !valid };
}

export const demoSessionCookie = (id: string) => `normal_demo_session=${id}; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax`;
