import { NextResponse } from "next/server";

export async function POST() {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Missing client ID" }, { status: 500 });
  }

  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: "repo read:org",
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
