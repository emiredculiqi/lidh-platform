import type { LucideIcon } from "lucide-react";
import {
  Stethoscope,
  UtensilsCrossed,
  Briefcase,
  Building2,
} from "lucide-react";

export type UseCase = {
  id: string;
  icon: LucideIcon;
  title: { al: string; en: string };
  body: { al: string; en: string };
  highlight?: boolean;
};

export const useCases: UseCase[] = [
  {
    id: "clinics",
    icon: Stethoscope,
    highlight: true,
    title: {
      al: "Klinika & Shëndetësi",
      en: "Clinics & Health",
    },
    body: {
      al:
        "Cakto takime, përgjigju pyetjeve për shërbime dhe çmime, dhe drejto pacientët te mjeku i duhur — pa e ngarkuar recepsionin.",
      en:
        "Book appointments, answer service and pricing questions, and route patients to the right doctor — without overloading reception.",
    },
  },
  {
    id: "hospitality",
    icon: UtensilsCrossed,
    highlight: true,
    title: {
      al: "Hotelieri & Restorante",
      en: "Hospitality & Restaurants",
    },
    body: {
      al:
        "Rezervime, menu, orare dhe pyetje për lokacionin — automatikisht në çdo gjuhë, edhe natën vonë.",
      en:
        "Reservations, menus, opening hours and location questions — automatically, in any language, even late at night.",
    },
  },
  {
    id: "professional",
    icon: Briefcase,
    highlight: true,
    title: {
      al: "Shërbime Profesionale",
      en: "Professional Services",
    },
    body: {
      al:
        "Avokatë, konsulentë, agjenci — kualifiko klientët potencialë dhe cakto takime pa humbur asnjë kërkesë.",
      en:
        "Lawyers, consultants, agencies — qualify prospects and book meetings without losing any inbound request.",
    },
  },
  {
    id: "real-estate",
    icon: Building2,
    highlight: true,
    title: {
      al: "Pasuri të Paluajtshme",
      en: "Real Estate",
    },
    body: {
      al:
        "Përgjigju pyetjeve për pronat, planifiko vizita dhe mbaj çdo lead të kualifikuar gati për agjentin.",
      en:
        "Answer property questions, schedule visits and keep every qualified lead ready for the agent.",
    },
  },
];
