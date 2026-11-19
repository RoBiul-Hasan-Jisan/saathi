import { NextResponse } from "next/server";

// Light guard: pages that need a login send visitors without a session cookie to /login.
// Real permission checks always happen in the backend.
const PROTECTED = ["/dashboard", "/cards", "/patients", "/eprescriptions", "/incidents", "/library", "/settings", "/admin", "/voices"];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !req.cookies.get("saathi_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/cards/:path*", "/patients/:path*", "/eprescriptions/:path*", "/incidents/:path*", "/library/:path*", "/settings/:path*", "/admin/:path*", "/voices/:path*"],
};
