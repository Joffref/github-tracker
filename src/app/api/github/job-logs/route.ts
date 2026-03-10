import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token, repo, jobId } = await req.json();
  if (!token || !repo || !jobId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/jobs/${jobId}/logs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "follow",
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `GitHub API ${res.status}` },
      { status: res.status }
    );
  }

  const logs = await res.text();
  return NextResponse.json({ logs });
}
