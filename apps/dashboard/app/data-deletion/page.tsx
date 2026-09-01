import { T } from "@/components/T";

export const metadata = {
  title: "Data deletion — Lidh.al",
  description:
    "Status of a data deletion request made through Meta / Facebook Login.",
};

/**
 * Public status page for Meta's Data Deletion Request callback.
 *
 * The API returns `{ url, confirmation_code }` from
 * POST /v1/webhooks/meta/data-deletion; `url` points here with `?code=…`. Meta
 * requires the URL to be reachable and to describe the request — this page is
 * that destination, and it is intentionally outside the Clerk-protected route
 * group (see middleware.ts) because the requester is not a logged-in user.
 *
 * Deletion is executed synchronously by the callback itself, so there is no
 * pending state to poll: by the time anyone opens this page the revocation has
 * already happened. The code is shown for support correspondence.
 */
export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-brand-deep">
        <T al="Fshirja e të dhënave" en="Data deletion" />
      </h1>

      {code ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-800">
            <T
              al="Kërkesa juaj është përpunuar."
              en="Your request has been processed."
            />
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            <T al="Kodi i konfirmimit:" en="Confirmation code:" />{" "}
            <code className="font-mono">{code}</code>
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">
          <T
            al="Kjo faqe tregon statusin e një kërkese për fshirje të dhënash të bërë përmes Meta-s. Nëse keni një kod konfirmimi, hapeni lidhjen që ju dha Meta."
            en="This page shows the status of a data deletion request made through Meta. If you have a confirmation code, open the link Meta gave you."
          />
        </p>
      )}

      <h2 className="mt-10 text-base font-semibold text-brand-deep">
        <T al="Çfarë fshihet" en="What gets deleted" />
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
        <li>
          <T
            al="Token-i i aksesit i ruajtur për llogarinë tuaj WhatsApp Business — shkatërrohet menjëherë."
            en="The stored access token for your WhatsApp Business account — destroyed immediately."
          />
        </li>
        <li>
          <T
            al="Lidhja e kanalit WhatsApp shkëputet; asistenti nuk përgjigjet më në numrin tuaj."
            en="The WhatsApp channel connection is severed; the assistant no longer answers on your number."
          />
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold text-brand-deep">
        <T al="Çfarë nuk fshihet automatikisht" en="What is not deleted automatically" />
      </h2>
      <p className="mt-3 text-sm text-slate-600">
        <T
          al="Bisedat dhe kontaktet e biznesit i përkasin llogarisë së biznesit te Lidh.al, jo llogarisë suaj Meta. Për t'i fshirë ato, kontaktoni privacy@lidh.al ose fshini llogarinë nga paneli."
          en="Business conversations and contacts belong to the Lidh.al business account, not to your Meta login. To erase those, contact privacy@lidh.al or delete the account from the dashboard."
        />
      </p>

      <p className="mt-10 text-xs text-slate-400">
        <T
          al="Pyetje? Shkruani në privacy@lidh.al"
          en="Questions? Email privacy@lidh.al"
        />
      </p>
    </main>
  );
}
