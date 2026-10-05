"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

/**
 * Reveals `text` word by word, the way a person types, and keeps up with a
 * text that is still growing (a streamed reply). Replies that arrive whole —
 * the scripted intake lines, a colleague's message pushed over the live
 * stream — read the same as streamed ones. `animate=false` renders at once
 * (restored history).
 */
export function TypedText({ text, animate = true }: { text: string; animate?: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!animate) {
      shownRef.current = text.length;
      setShown(text.length);
      return;
    }
    if (shownRef.current >= text.length) return;
    const id = setInterval(() => {
      const cur = shownRef.current;
      if (cur >= text.length) {
        clearInterval(id);
        return;
      }
      // Reveal through the next whitespace; when far behind a fast stream,
      // take several words per tick so the bubble never lags visibly.
      const remainingWords = text.slice(cur).split(/\s+/).length;
      const words = Math.max(1, Math.ceil(remainingWords / 40));
      let next = cur;
      for (let i = 0; i < words; i++) {
        const m = /\s+\S/.exec(text.slice(next + 1));
        next = m ? next + 1 + m.index + m[0].length - 1 : text.length;
        if (next >= text.length) break;
      }
      shownRef.current = Math.min(next, text.length);
      setShown(shownRef.current);
    }, 38);
    return () => clearInterval(id);
  }, [text, animate]);

  return <Markdown content={text.slice(0, shown)} />;
}
