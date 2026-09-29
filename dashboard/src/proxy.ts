import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: sends visitors without a session cookie to /login.
// FastAPI still verifies the key on every request.
export function proxy(request: NextRequest) {
  if (request.cookies.has("admin_key")) return NextResponse.next();

  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
