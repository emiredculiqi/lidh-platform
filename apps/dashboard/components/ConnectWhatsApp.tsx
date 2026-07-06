"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ChannelStatus } from "@/lib/api";
import { useT } from "@/lib/i18n";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;
const GRAPH_VERSION =
  process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v22.0";

type SessionInfo = { wabaId: string; phoneNumberId: string };
type FbLoginResponse = { authResponse?: { code?: string } | null };

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (res: FbLoginResponse) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * Self-serve WhatsApp connect via Meta Embedded Signup (coexistence). The
 * owner clicks Connect → Meta popup (Facebook login + scan a QR from their
 * WhatsApp Business App). Two async signals come back: the popup's auth `code`
 * (FB.login callback) and the WABA/phone ids (a window `message` event). We
 * reconcile both, then POST to the backend which exchanges the code and wires
 * the channel.
 */
export function ConnectWhatsApp({
  slug,
  initial,
}: {
  slug: string;
  initial: ChannelStatus | null;
}) {
  const [status, setStatus] = useState(initial?.status ?? "disconnected");
  const [displayNumber, setDisplayNumber] = useState<string | null>(
    initial?.displayPhoneNumber ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);

  const t = useT({
    al: {
      title: "WhatsApp Business",
      connected: "i lidhur",
      notConnected: "i palidhur",
      connect: "Lidh WhatsApp",
      connecting: "Duke u lidhur…",
      disconnect: "Shkëput",
      loading: "Duke ngarkuar…",
      notConfigured:
        "Integrimi me Meta nuk është konfiguruar ende. Kontaktoni administratorin.",
      cancelled: "Lidhja u anulua.",
      noSession:
        "Nuk morëm të dhënat e numrit nga Meta. Provoni sërish.",
      help: "Mbani WhatsApp Business App në telefon; asistenti përgjigjet në të njëjtin numër.",
    },
    en: {
      title: "WhatsApp Business",
      connected: "connected",
      notConnected: "not connected",
      connect: "Connect WhatsApp",
      connecting: "Connecting…",
      disconnect: "Disconnect",
      loading: "Loading…",
      notConfigured:
        "Meta integration isn't configured yet. Contact your administrator.",
      cancelled: "Connection cancelled.",
      noSession: "Didn't receive the number details from Meta. Try again.",
      help: "Keep the WhatsApp Business App on your phone; the assistant answers on the same number.",
    },
  });

  // Load the Facebook JS SDK once (only when Meta is configured).
  useEffect(() => {
    if (!APP_ID) return;
    if (window.FB) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: GRAPH_VERSION,
      });
      setSdkReady(true);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
  }, []);

  // Capture the Embedded Signup session info (waba_id + phone_number_id).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      let host = "";
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (!host.endsWith("facebook.com")) return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          const d = data.data ?? {};
          if (d.waba_id && d.phone_number_id) {
            sessionInfoRef.current = {
              wabaId: String(d.waba_id),
              phoneNumberId: String(d.phone_number_id),
            };
          }
        }
      } catch {
        /* ignore non-JSON postMessages */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connect() {
    if (!window.FB || !CONFIG_ID) return;
    setError(null);
    setBusy(true);
    sessionInfoRef.current = null;

    const code = await new Promise<string | null>((resolve) => {
      window.FB!.login((res) => resolve(res.authResponse?.code ?? null), {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding", // coexistence
          sessionInfoVersion: "3",
          version: "v4", // Embedded Signup flow version (matches Meta config)
        },
      });
    });
    if (!code) {
      setBusy(false);
      setError(t.cancelled);
      return;
    }

    const info = await waitForSessionInfo();
    if (!info) {
      setBusy(false);
      setError(t.noSession);
      return;
    }

    try {
      const res = await api.connectWhatsApp(slug, {
        code,
        wabaId: info.wabaId,
        phoneNumberId: info.phoneNumberId,
        coexistence: true,
      });
      setStatus(res.status);
      setDisplayNumber(res.displayPhoneNumber ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function waitForSessionInfo(): Promise<SessionInfo | null> {
    return new Promise((resolve) => {
      if (sessionInfoRef.current) return resolve(sessionInfoRef.current);
      let tries = 0;
      const iv = setInterval(() => {
        if (sessionInfoRef.current) {
          clearInterval(iv);
          resolve(sessionInfoRef.current);
        } else if (++tries > 30) {
          clearInterval(iv);
          resolve(null);
        }
      }, 100);
    });
  }

  async function disconnect() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.disconnectWhatsApp(slug);
      setStatus(res.status);
      setDisplayNumber(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const isConnected = status === "connected";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-slate-300"
            }`}
          />
          <div>
            <div className="text-[13.5px] font-semibold text-brand-deep">
              {t.title}
            </div>
            {isConnected && displayNumber ? (
              <div className="text-xs text-slate-500">{displayNumber}</div>
            ) : null}
          </div>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            isConnected
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {isConnected ? t.connected : t.notConnected}
        </span>
      </div>

      {!APP_ID ? (
        <p className="text-xs text-slate-500">{t.notConfigured}</p>
      ) : isConnected ? (
        <button
          onClick={disconnect}
          disabled={busy}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? t.loading : t.disconnect}
        </button>
      ) : (
        <>
          <button
            onClick={connect}
            disabled={busy || !sdkReady}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t.connecting : !sdkReady ? t.loading : t.connect}
          </button>
          <p className="text-xs text-slate-500">{t.help}</p>
        </>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
