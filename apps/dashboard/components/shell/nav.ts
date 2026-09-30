// The workspace navigation, shared by the desktop sidebar and the phone
// tab bar so the two can never drift apart.

export type Item = { id: string; suffix: string; al: string; en: string; icon: string };

// New IA (matches the redesign). Leads kept as a tab since it's core today;
// it folds into Bisedat later. Usage folds into the dashboard.
export const NAV: Item[] = [
  { id: "dashboard", suffix: "", al: "Paneli", en: "Dashboard", icon: "M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" },
  { id: "inbox", suffix: "/inbox", al: "Bisedat", en: "Conversations", icon: "M4 4h16v12H7l-3 3V4z" },
  { id: "contacts", suffix: "/contacts", al: "Kontakte", en: "Contacts", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { id: "calendar", suffix: "/calendar", al: "Kalendari", en: "Calendar", icon: "M3 5h18v16H3V5zm0 5h18M8 3v4m8-4v4" },
  { id: "settings", suffix: "/settings", al: "Cilësimet", en: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1l-.4-2.6H9.2l-.4 2.6a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 001.7 1l.4 2.6h4.6l.4-2.6a7.6 7.6 0 001.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z" },
];

// Team management — only shown to owner/admin (or platform admin).
export const TEAM_ITEM: Item = {
  id: "team",
  suffix: "/team",
  al: "Ekipi",
  en: "Team",
  icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
};
