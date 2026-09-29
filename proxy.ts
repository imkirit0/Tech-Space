export { auth as proxy } from "@/auth";
export const config = { matcher: ["/dashboard/:path*", "/activities/:path*", "/manager/:path*", "/tasks/:path*", "/api/export"] };
