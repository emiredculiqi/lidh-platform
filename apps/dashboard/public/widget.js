/**
 * Lidh.al embeddable chat widget.
 *
 * A business drops ONE line on their site:
 *   <script src="https://app.lidh.al/widget.js" data-tenant="acme-coffee" defer></script>
 *
 * It injects a floating chat bubble + panel, isolated in a Shadow DOM (so the
 * host site's CSS can't break it and vice-versa), and talks to the public
 * streaming chat endpoint POST {api}/v1/chat/web over SSE.
 *
 * Config via data-* on the script tag:
 *   data-tenant   (required) the tenant slug
 *   data-api      API base       (default https://api.lidh.al)
 *   data-color    primary color  (default #2563eb)
 *   data-title    panel title    (default "Chat")
 *   data-locale   reply locale   (default al)
 *   data-greeting opening line shown in the panel
 */
(function () {
  "use strict";
  if (window.__lidhWidgetLoaded) return;
  window.__lidhWidgetLoaded = true;

  var script =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"][data-tenant]');
  if (!script) return;

  var cfg = {
    tenant: script.getAttribute("data-tenant"),
    api: (script.getAttribute("data-api") || "https://api.lidh.al").replace(
      /\/$/,
      ""
    ),
    color: script.getAttribute("data-color") || "#2563eb",
    title: script.getAttribute("data-title") || "Chat",
    locale: script.getAttribute("data-locale") || "al",
    greeting: script.getAttribute("data-greeting") || "",
  };
  if (!cfg.tenant) {
    console.error("[lidh] widget: missing data-tenant");
    return;
  }

  var SESSION_KEY = "lidh:wsess:" + cfg.tenant;
  var sessionRef =
    localStorage.getItem(SESSION_KEY) ||
    "w_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(SESSION_KEY, sessionRef);
  var conversationId = null;

  // ── Shadow-DOM host ──────────────────────────────────────────────────────
  var host = document.createElement("div");
  host.style.cssText =
    "position:fixed;bottom:0;right:0;z-index:2147483647;font-family:-apple-system,Segoe UI,Roboto,sans-serif";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  root.innerHTML =
    "<style>" +
    "*{box-sizing:border-box}" +
    ".launch{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:" +
    cfg.color +
    ";box-shadow:0 6px 20px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;transition:transform .15s}" +
    ".launch:hover{transform:scale(1.06)}" +
    ".launch svg{width:26px;height:26px;fill:#fff}" +
    ".panel{position:fixed;bottom:88px;right:20px;width:370px;max-width:calc(100vw - 40px);height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden}" +
    ".panel.open{display:flex}" +
    ".head{background:" +
    cfg.color +
    ";color:#fff;padding:14px 16px;font-weight:600;display:flex;align-items:center;justify-content:space-between}" +
    ".head button{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;opacity:.85}" +
    ".msgs{flex:1;overflow-y:auto;padding:16px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}" +
    ".row{display:flex}.row.u{justify-content:flex-end}" +
    ".bub{max-width:80%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
    ".row.a .bub{background:#fff;border:1px solid #e2e8f0;color:#0f172a;border-bottom-left-radius:4px}" +
    ".row.u .bub{background:" +
    cfg.color +
    ";color:#fff;border-bottom-right-radius:4px}" +
    ".bub a{color:inherit;text-decoration:underline}" +
    ".row.a .bub a{color:" +
    cfg.color +
    "}" +
    ".eff{align-self:center;font-size:12px;color:#64748b;background:#eef2ff;padding:4px 10px;border-radius:999px}" +
    ".foot{border-top:1px solid #e2e8f0;padding:10px;display:flex;gap:8px;background:#fff}" +
    ".foot textarea{flex:1;resize:none;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:14px;font-family:inherit;max-height:90px;outline:none}" +
    ".foot textarea:focus{border-color:" +
    cfg.color +
    "}" +
    ".foot button{border:none;background:" +
    cfg.color +
    ";color:#fff;border-radius:10px;width:40px;cursor:pointer;font-size:16px}" +
    ".foot button:disabled{opacity:.5;cursor:default}" +
    ".credit{text-align:center;font-size:11px;color:#94a3b8;padding:6px}" +
    ".dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#94a3b8;margin:0 1px;animation:b 1s infinite}" +
    ".dot:nth-child(2){animation-delay:.15s}.dot:nth-child(3){animation-delay:.3s}" +
    "@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}" +
    "</style>" +
    '<button class="launch" aria-label="Chat">' +
    '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1L4 21l3.9-1.3c1.3.4 2.7.6 4.1.6 5.5 0 10-3.8 10-8.8S17.5 3 12 3z"/></svg>' +
    "</button>" +
    '<div class="panel" role="dialog">' +
    '<div class="head"><span></span><button class="x" aria-label="Close">×</button></div>' +
    '<div class="msgs"></div>' +
    '<div class="foot"><textarea rows="1" placeholder="..."></textarea><button class="send">→</button></div>' +
    '<div class="credit">Powered by Lidh.al</div>' +
    "</div>";

  var $ = function (s) {
    return root.querySelector(s);
  };
  $(".head span").textContent = cfg.title;
  var panel = $(".panel"),
    msgs = $(".msgs"),
    input = $(".foot textarea"),
    sendBtn = $(".send");

  function open() {
    panel.classList.add("open");
    input.focus();
    if (cfg.greeting && !msgs.children.length) addMsg("a", cfg.greeting);
  }
  $(".launch").addEventListener("click", function () {
    panel.classList.contains("open") ? panel.classList.remove("open") : open();
  });
  $(".x").addEventListener("click", function () {
    panel.classList.remove("open");
  });

  // ── tiny safe markdown: escape, then links + bold + line breaks ──────────
  function render(text) {
    var e = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    e = e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + t + "</a>";
    });
    e = e.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return e;
  }

  function addMsg(role, text) {
    var row = document.createElement("div");
    row.className = "row " + role;
    var bub = document.createElement("div");
    bub.className = "bub";
    bub.innerHTML = render(text);
    row.appendChild(bub);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return bub;
  }

  function addEffect(type) {
    var d = document.createElement("div");
    d.className = "eff";
    d.textContent =
      type === "lead_captured"
        ? cfg.locale === "al"
          ? "✓ Të dhënat u ruajtën"
          : "✓ Details saved"
        : cfg.locale === "al"
        ? "✓ Po ju lidhim me një person"
        : "✓ Connecting you to a person";
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 90) + "px";
  });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      submit();
    }
  });
  sendBtn.addEventListener("click", submit);

  var busy = false;
  function submit() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    input.style.height = "auto";
    addMsg("u", text);
    stream(text);
  }

  async function stream(message) {
    busy = true;
    sendBtn.disabled = true;
    var typing = addMsg("a", "");
    typing.innerHTML =
      '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    var acc = "";
    try {
      var res = await fetch(cfg.api + "/v1/chat/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: cfg.tenant,
          message: message,
          sessionRef: sessionRef,
          conversationId: conversationId || undefined,
          locale: cfg.locale,
        }),
      });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = "";
      while (true) {
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split("\n\n");
        buf = parts.pop();
        for (var i = 0; i < parts.length; i++) {
          var ev = "message",
            data = "";
          var lines = parts[i].split("\n");
          for (var j = 0; j < lines.length; j++) {
            if (lines[j].indexOf("event:") === 0)
              ev = lines[j].slice(6).trim();
            else if (lines[j].indexOf("data:") === 0)
              data += lines[j].slice(5).trim();
          }
          var payload = {};
          try {
            payload = JSON.parse(data);
          } catch (e) {}
          if (ev === "meta" && payload.conversationId)
            conversationId = payload.conversationId;
          else if (ev === "text" && payload.delta) {
            acc += payload.delta;
            typing.innerHTML = render(acc);
            msgs.scrollTop = msgs.scrollHeight;
          } else if (ev === "effect" && payload.type) addEffect(payload.type);
          else if (ev === "error") throw new Error(payload.message || "error");
        }
      }
      if (!acc)
        typing.innerHTML = render(
          cfg.locale === "al"
            ? "Më vjen keq, diçka shkoi keq. Provo përsëri."
            : "Sorry, something went wrong. Please try again."
        );
    } catch (err) {
      typing.innerHTML = render(
        cfg.locale === "al"
          ? "Lidhja dështoi. Provo përsëri."
          : "Connection failed. Please try again."
      );
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }
})();
