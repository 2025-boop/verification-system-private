import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/api";

export async function GET() {
  console.log("===== PROXY TEST HIT =====");

  // 1) Read cookies on the server
  const cookieStore = await cookies();
  const access = cookieStore.get("access")?.value;

  if (!access) {
    console.log("No access token in cookies");
    return NextResponse.json(
      { detail: "No access token" },
      { status: 401 }
    );
  }

  // 2) Forward request to Django with Authorization header
  const apiRes = await fetch(getBackendUrl("/api/auth/protected-test/"), {
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await apiRes.json();

  console.log("Status:", apiRes.status);
  console.log("Response Data:", data);

  // 3) Return Django response back to client
  return NextResponse.json(data, { status: apiRes.status });
}
