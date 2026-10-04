"use client";

// Dictation into the journal box with Azure AI Speech. The server hands out a short-lived token
// (POST /api/speech/token); the SDK is loaded on first press so it stays out of the page bundle.
import { useEffect, useRef, useState } from "react";
import type { SpeechRecognizer } from "microsoft-cognitiveservices-speech-sdk";
import { getSpeechToken } from "@/lib/client";
import { LEAF_MIDRIB, LEAF_PATH } from "@/components/tree/treeModel";

type Mode = "idle" | "starting" | "listening";

export default function DictateButton({ onText, onInterim, onActive, onError }: {
  onText: (text: string) => void;
  /** The phrase heard so far, before it's final; "" clears it */
  onInterim: (text: string) => void;
  /** True from the press until dictation stops, so the box can show it's listening */
  onActive: (on: boolean) => void;
  onError: (message: string) => void;
}) {
  const [mode, setModeState] = useState<Mode>("idle");
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const run = useRef(0); // bumped on stop, so a start or phrase still on its way is ignored
  const setMode = (m: Mode) => { setModeState(m); onActive(m !== "idle"); };

  function stop() {
    run.current++;
    onInterim("");
    const r = recognizer.current;
    recognizer.current = null;
    if (r) r.stopContinuousRecognitionAsync(() => r.close(), () => r.close());
    setMode("idle");
  }

  function fail(message: string) {
    stop();
    onError(message);
  }

  async function start() {
    const id = ++run.current;
    setMode("starting");
    try {
      const [{ token, region }, sdk] = await Promise.all([getSpeechToken(), import("microsoft-cognitiveservices-speech-sdk")]);
      if (id !== run.current) return;
      const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      config.speechRecognitionLanguage = "en-US";
      const r = new sdk.SpeechRecognizer(config, sdk.AudioConfig.fromDefaultMicrophoneInput());
      recognizer.current = r;
      r.recognizing = (_, e) => { if (id === run.current) onInterim(e.result.text); };
      r.recognized = (_, e) => {
        if (id !== run.current) return;
        onInterim("");
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) onText(e.result.text);
      };
      r.canceled = (_, e) => {
        if (id !== run.current || e.reason !== sdk.CancellationReason.Error) return;
        console.error("dictation canceled", e.errorDetails);
        fail("Dictation stopped. Check that Sprout can use your microphone, then try again.");
      };
      r.startContinuousRecognitionAsync(
        () => { if (id === run.current) setMode("listening"); },
        err => { console.error("dictation failed to start", err); fail("Couldn't start dictation. Check that Sprout can use your microphone."); },
      );
    } catch (e) {
      if (id !== run.current) return;
      console.error("dictation failed to start", e);
      fail("Dictation is unavailable right now. You can still type your entry.");
    }
  }

  // Stop listening when the writing box goes away (e.g. after Save)
  useEffect(() => () => {
    run.current++;
    onInterim("");
    onActive(false);
    const r = recognizer.current;
    if (r) r.stopContinuousRecognitionAsync(() => r.close(), () => r.close());
  }, []);

  const on = mode !== "idle";
  return (
    <button type="button" onClick={on ? stop : start} aria-pressed={on}
      aria-label={on ? "Stop dictation" : "Start dictation"} title={on ? undefined : "Speak your entry"}
      className={`flex h-6 cursor-pointer items-center gap-1 rounded-full ${on ? "pr-2.5 pl-1.5" : "px-1"} text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber ${on ? "bg-lichen/25 text-moss hover:bg-lichen/40" : "text-ink-soft hover:bg-lichen/20 hover:text-moss"}`}>
      {/* A mic growing on a stalk, with the Grove's leaf off its stem; the leaf stirs while Sprout is listening */}
      <svg aria-hidden viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4.75" y="1.5" width="5.5" height="9" rx="2.75" />
        <path d="M4.75 6h5.5M2.5 8.5a5 5 0 0010 0M7.5 13.5v5" />
        <g transform="translate(7.5 16.25) rotate(-32) scale(.47)">
          <g className={mode === "listening" ? "animate-listen" : undefined} style={{ transformOrigin: "0 0" }}>
            <path d={LEAF_PATH} fill="var(--color-lichen)" stroke="var(--color-moss)" strokeWidth={2.6} />
            <path d={LEAF_MIDRIB} stroke="rgba(255,255,255,.6)" strokeWidth={2} />
          </g>
        </g>
      </svg>
      <span aria-live="polite" className="empty:hidden">
        {mode === "starting" ? "Starting…" : mode === "listening" ? <>Listening<span aria-hidden className="inline-block animate-ellipsis">...</span> click to stop</> : ""}
      </span>
    </button>
  );
}
