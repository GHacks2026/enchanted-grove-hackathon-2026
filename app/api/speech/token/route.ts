import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";

// POST /api/speech/token — CONTRACT §8. A 10-minute Azure Speech token for dictation; the key never leaves the server.
export async function POST() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  try {
    if (!key || !region) throw new Error("AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not set");
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    if (!res.ok) throw new Error(`issueToken → ${res.status} ${await res.text()}`);
    return NextResponse.json({ token: await res.text(), region });
  } catch (err) {
    console.error("speech token failed", err);
    return apiError("speech_failed", "Dictation is unavailable right now.", 502);
  }
}
