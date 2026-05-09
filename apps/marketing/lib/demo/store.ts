import "server-only";
import type { CrawlResult } from "./crawler";

export const MAX_PROMPTS = 3;
export const SESSION_TTL_MS = 60 * 60 * 1000;

export type DemoLead = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  websiteUrl: string;
};

export type DemoMessage = { role: "user" | "assistant"; content: string };

export type DemoSession = {
  id: string;
  lead: DemoLead;
  status: "crawling" | "ready" | "failed";
  crawl?: CrawlResult;
  failureReason?: string;
  promptsUsed: number;
  createdAt: number;
  locale: "al" | "en";
  messages: DemoMessage[];
  summarySent: boolean;
};

const globalKey = Symbol.for("lidh.demo.sessions");
const usedEmailsKey = Symbol.for("lidh.demo.usedEmails");
type GlobalWithSessions = typeof globalThis & {
  [globalKey]?: Map<string, DemoSession>;
  [usedEmailsKey]?: Set<string>;
};
const g = globalThis as GlobalWithSessions;
const sessions: Map<string, DemoSession> =
  g[globalKey] ?? (g[globalKey] = new Map<string, DemoSession>());
const usedEmails: Set<string> =
  g[usedEmailsKey] ?? (g[usedEmailsKey] = new Set<string>());

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasEmailBeenUsed(email: string): boolean {
  return usedEmails.has(normalizeEmail(email));
}

export function markEmailUsed(email: string): void {
  usedEmails.add(normalizeEmail(email));
}

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function createSession(
  lead: DemoLead,
  locale: "al" | "en",
): DemoSession {
  sweep();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const session: DemoSession = {
    id,
    lead,
    status: "crawling",
    promptsUsed: 0,
    createdAt: Date.now(),
    locale,
    messages: [],
    summarySent: false,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): DemoSession | undefined {
  sweep();
  return sessions.get(id);
}

export function setSessionReady(id: string, crawl: CrawlResult) {
  const s = sessions.get(id);
  if (!s) return;
  s.status = "ready";
  s.crawl = crawl;
}

export function setSessionFailed(id: string, reason: string) {
  const s = sessions.get(id);
  if (!s) return;
  s.status = "failed";
  s.failureReason = reason;
}

export function incrementPrompts(id: string): number {
  const s = sessions.get(id);
  if (!s) return 0;
  s.promptsUsed += 1;
  return s.promptsUsed;
}

export function appendMessages(id: string, msgs: DemoMessage[]): void {
  const s = sessions.get(id);
  if (!s) return;
  s.messages.push(...msgs);
}

export function markSummarySent(id: string): void {
  const s = sessions.get(id);
  if (!s) return;
  s.summarySent = true;
}
