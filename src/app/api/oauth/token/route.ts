import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Missing client ID" }, { status: 500 });
  }

  const body = await request.json();

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      device_code: body.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
