import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { LocaleProvider } from "@/lib/i18n";
import { ChatWidget } from "@/components/Chat/ChatWidget";
import "./globals.css";

const GTM_ID = "GTM-NWQ5VJC9";
const GA_ID = "G-6RL93PTKKR";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lidh.al"),
  title: {
    default: "Lidh.al — Customer support & lead management for Albanian businesses",
    template: "%s · Lidh.al",
  },
  description:
    "Always-on customer support and lead management for Albanian businesses. Works on your website, WhatsApp, Instagram and Facebook.",
  openGraph: {
    title: "Lidh.al",
    description:
      "Always-on customer support and lead management for Albanian businesses.",
    url: "https://lidh.al",
    siteName: "Lidh.al",
    locale: "sq_AL",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sq" className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        <Script
          id="ga-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </head>
      <body>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <LocaleProvider>
          {children}
          <ChatWidget />
        </LocaleProvider>
      </body>
    </html>
  );
}
