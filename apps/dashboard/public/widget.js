/**
 * Lidh.al embeddable chat widget.
 *
 *   <script src="https://app.lidh.al/widget.js" data-tenant="acme-coffee" defer></script>
 *
 * Floating bubble + panel, isolated in a Shadow DOM, talking to the public
 * streaming endpoint POST {api}/v1/chat/web over SSE. Styled to match the
 * Lidh.al brand widget (ChatWidget.tsx) using dependency-free CSS/JS.
 *
 * data-* : data-tenant (required), data-api, data-title, data-locale,
 *          data-greeting, data-teaser.
 */
(function () {
  "use strict";
  if (window.__lidhWidgetLoaded) return;
  window.__lidhWidgetLoaded = true;

  var script =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"][data-tenant]');
  if (!script) return;

  var al = (script.getAttribute("data-locale") || "al") === "al";
  var cfg = {
    tenant: script.getAttribute("data-tenant"),
    api: (script.getAttribute("data-api") || "https://api.lidh.al").replace(/\/$/, ""),
    title: script.getAttribute("data-title") || (al ? "Asistenti" : "Assistant"),
    locale: al ? "al" : "en",
    greeting:
      script.getAttribute("data-greeting") ||
      (al ? "Përshëndetje! 👋 Si mund t'ju ndihmoj sot?" : "Hi! 👋 How can I help you today?"),
    teaser:
      script.getAttribute("data-teaser") ||
      (al ? "Pyetje? Bisedo me ne 👋" : "Questions? Chat with us 👋"),
    subtitle: al ? "Online tani — përgjigje në sekonda" : "Online now — replies in seconds",
  };
  if (!cfg.tenant) {
    console.error("[lidh] widget: missing data-tenant");
    return;
  }

  // Exact brand tokens (tailwind.config.ts).
  var GRAD = "linear-gradient(135deg,#0B2A6B 0%,#1E5FDB 35%,#22D3EE 70%,#5EEAD4 100%)";
  var BLUE = "#1E5FDB";
  var DEEP = "#0B2A6B";
  var GLOW = "0 30px 80px -30px rgba(30,95,219,.45)";

  var SKEY = "lidh:wsess:" + cfg.tenant;
  var MKEY = "lidh:wmsgs:" + cfg.tenant;
  var TKEY = "lidh:wteaser:" + cfg.tenant;
  var sessionRef =
    localStorage.getItem(SKEY) ||
    "w_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(SKEY, sessionRef);
  var conversationId = null;
  var history = [];
  try {
    var stored = JSON.parse(localStorage.getItem(MKEY) || "[]");
    if (Array.isArray(stored)) history = stored.slice(-30);
  } catch (e) {}
  function persist() {
    try { localStorage.setItem(MKEY, JSON.stringify(history.slice(-30))); } catch (e) {}
  }

  var host = document.createElement("div");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  // lucide icons (stroke style)
  var I_MSG = svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', 24);
  var I_X = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 24);
  var I_X_SM = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 16);
  var I_X_XS = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 13);
  var I_SEND = svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', 16);
  function svg(inner, n) {
    return '<svg viewBox="0 0 24 24" width="' + n + '" height="' + n +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }

  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0}" +
    // launcher + pulse ring
    ".ring{position:fixed;bottom:20px;right:16px;width:56px;height:56px;border-radius:50%;background:rgba(30,95,219,.4);z-index:2147483640;display:none;animation:pulse 1.6s ease-out infinite;pointer-events:none}" +
    "@keyframes pulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.4);opacity:0}}" +
    ".launch{position:fixed;bottom:20px;right:16px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:" + GRAD + ";box-shadow:" + GLOW + ";color:#fff;display:flex;align-items:center;justify-content:center;z-index:2147483646;transition:transform .15s}" +
    ".launch:hover{transform:scale(1.05)}.launch:active{transform:scale(.95)}" +
    ".launch .ic{display:flex;animation:spin .18s ease-out}" +
    "@keyframes spin{from{transform:rotate(-90deg);opacity:0}to{transform:rotate(0);opacity:1}}" +
    // teaser
    ".teaser{position:fixed;bottom:28px;right:80px;max-width:14rem;z-index:2147483646;display:none;align-items:flex-start;gap:8px;background:#fff;padding:8px 12px;border-radius:16px 16px 4px 16px;box-shadow:0 12px 32px rgba(11,42,107,.18);outline:1px solid rgba(11,42,107,.1);cursor:pointer;animation:tin .25s ease-out}" +
    "@keyframes tin{from{opacity:0;transform:translateY(10px) scale(.9)}to{opacity:1;transform:none}}" +
    ".teaser .tt{font-size:12px;font-weight:500;line-height:1.35;color:" + DEEP + ";min-height:1.1rem}" +
    ".teaser .cur{display:inline-block;width:1px;height:12px;background:rgba(11,42,107,.6);vertical-align:middle;margin-left:1px;animation:blink .6s steps(1) infinite}" +
    "@keyframes blink{50%{opacity:0}}" +
    ".teaser .tx{flex:none;border:none;background:transparent;color:rgba(11,42,107,.4);cursor:pointer;padding:0;display:flex;margin-top:-1px}" +
    // panel
    ".panel{position:fixed;bottom:104px;right:24px;z-index:2147483645;width:380px;max-width:calc(100vw - 32px);height:min(640px,calc(100dvh - 7rem));background:#fff;border:1px solid rgba(11,42,107,.1);border-radius:16px;box-shadow:0 25px 50px -12px rgba(11,42,107,.35);display:none;flex-direction:column;overflow:hidden}" +
    ".panel.open{display:flex;animation:pop .18s ease-out}" +
    ".panel.closing{animation:popout .16s ease-in forwards}" +
    "@keyframes pop{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:none}}" +
    "@keyframes popout{to{opacity:0;transform:translateY(20px) scale(.96)}}" +
    "@media (max-width:639px){.panel{inset:0;top:0;right:0;left:0;bottom:auto;width:100%;max-width:none;height:var(--vv-h,100dvh);border-radius:0;border:none}}" +
    // header
    ".head{display:flex;align-items:center;justify-content:space-between;gap:12px;background:" + GRAD + ";color:#fff;padding:12px 16px}" +
    ".head .t{font-size:14px;font-weight:600;line-height:1.15}" +
    ".head .s{display:flex;align-items:center;gap:6px;font-size:11px;opacity:.8;margin-top:2px}" +
    ".head .s i{width:6px;height:6px;border-radius:50%;background:#6ee7b7;display:inline-block}" +
    ".head .x{background:transparent;border:none;color:rgba(255,255,255,.8);cursor:pointer;padding:6px;border-radius:8px;display:flex;transition:background .15s}" +
    ".head .x:hover{background:rgba(255,255,255,.12);color:#fff}" +
    // messages
    ".msgs{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;background:rgba(248,250,252,.55);padding:16px;display:flex;flex-direction:column;gap:12px}" +
    ".row{display:flex}.row.u{justify-content:flex-end}" +
    ".bub{max-width:85%;padding:8px 12px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;box-shadow:0 1px 2px rgba(11,42,107,.06)}" +
    ".row.a .bub{background:#fff;color:" + DEEP + ";border-radius:16px 16px 16px 4px}" +
    ".row.u .bub{background:" + BLUE + ";color:#fff;border-radius:16px 16px 4px 16px}" +
    ".bub a{color:inherit;text-decoration:underline}.row.a .bub a{color:" + BLUE + "}" +
    ".bub strong{font-weight:600}" +
    ".eff{align-self:flex-start;display:flex;align-items:flex-start;gap:8px;font-size:12px;font-weight:500;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;padding:8px 12px;border-radius:12px}" +
    ".typing{display:flex}.typing .b{background:#fff;border-radius:16px 16px 16px 4px;padding:10px 14px;box-shadow:0 1px 2px rgba(11,42,107,.06);display:flex;gap:4px}" +
    ".typing .b span{width:6px;height:6px;border-radius:50%;background:rgba(11,42,107,.4);animation:bounce .8s ease-in-out infinite}" +
    ".typing .b span:nth-child(2){animation-delay:.15s}.typing .b span:nth-child(3){animation-delay:.3s}" +
    "@keyframes bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-3px)}}" +
    // input
    ".foot{border-top:1px solid rgba(11,42,107,.1);background:#fff;padding:8px 12px 12px}" +
    ".ibox{display:flex;align-items:flex-end;gap:8px;border:1px solid rgba(11,42,107,.15);border-radius:12px;background:#fff;padding:6px 8px;transition:border-color .15s,box-shadow .15s}" +
    ".ibox:focus-within{border-color:" + BLUE + ";box-shadow:0 0 0 2px rgba(30,95,219,.2)}" +
    ".ibox textarea{flex:1;resize:none;border:none;outline:none;background:transparent;color:" + DEEP + ";font-size:14px;line-height:1.4;padding:6px 8px;max-height:160px;min-height:40px}" +
    ".ibox textarea::placeholder{color:rgba(11,42,107,.4)}" +
    ".ibox .send{flex:none;width:36px;height:36px;border:none;border-radius:8px;cursor:pointer;background:" + GRAD + ";color:#fff;display:flex;align-items:center;justify-content:center;transition:opacity .15s}" +
    ".ibox .send:disabled{opacity:.4;cursor:not-allowed}" +
    ".credit{text-align:center;font-size:10px;color:rgba(11,42,107,.4);margin-top:6px}" +
    "</style>" +
    '<div class="ring"></div>' +
    '<button class="launch" aria-label="Chat"><span class="ic">' + I_MSG + "</span></button>" +
    '<div class="teaser"><span class="tt"></span><button class="tx" aria-label="Dismiss">' + I_X_XS + "</button></div>" +
    '<div class="panel" role="dialog">' +
    '<div class="head"><div><div class="t"></div><div class="s"><i></i><span></span></div></div>' +
    '<button class="x" aria-label="Close">' + I_X_SM + "</button></div>" +
    '<div class="msgs"></div>' +
    '<div class="foot"><form class="ibox"><textarea rows="2" placeholder="' + (al ? "Shkruaj mesazhin..." : "Type your message...") + '"></textarea>' +
    '<button class="send" type="submit" aria-label="Send" disabled>' + I_SEND + "</button></form>" +
    '<div class="credit">Powered by Lidh.al</div></div>' +
    "</div>";

  var $ = function (s) { return root.querySelector(s); };
  $(".head .t").textContent = cfg.title;
  $(".head .s span").textContent = cfg.subtitle;

  var ring = $(".ring"),
    launch = $(".launch"),
    teaser = $(".teaser"),
    tt = $(".teaser .tt"),
    panel = $(".panel"),
    msgs = $(".msgs"),
    form = $(".ibox"),
    input = $(".ibox textarea"),
    sendBtn = $(".send");

  var isOpen = false;
  var greeted = false;
  history.forEach(function (m) { addMsg(m.role === "user" ? "u" : "a", m.content); });

  function setOpen(v) {
    if (v === isOpen) return;
    isOpen = v;
    hideTeaser();
    if (v) {
      panel.classList.remove("closing");
      panel.classList.add("open");
      launch.querySelector(".ic").innerHTML = I_X;
      lockBody(true);
      // On mobile the panel is full-screen, so the floating launcher would
      // overlap the input. Hide it — the header ✕ closes the panel there.
      if (mq.matches) launch.style.display = "none";
      if (!history.length && !greeted) { greeted = true; addMsg("a", cfg.greeting); }
      setTimeout(function () { input.focus(); scrollDown(); }, 70);
    } else {
      panel.classList.add("closing");
      launch.style.display = "";
      launch.querySelector(".ic").innerHTML = I_MSG;
      lockBody(false);
      setTimeout(function () { panel.classList.remove("open", "closing"); }, 160);
    }
    bumpIcon();
  }
  function bumpIcon() {
    var ic = launch.querySelector(".ic");
    ic.style.animation = "none";
    void ic.offsetWidth;
    ic.style.animation = "spin .18s ease-out";
  }
  launch.addEventListener("click", function () { dismissTeaser(); setOpen(!isOpen); });
  $(".head .x").addEventListener("click", function () { setOpen(false); });

  // mobile: lock body scroll + track keyboard via visualViewport
  var mq = window.matchMedia("(max-width: 639px)");
  var prevOverflow = "";
  function lockBody(on) {
    if (!mq.matches) return;
    if (on) { prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; applyVV(); }
    else { document.body.style.overflow = prevOverflow; }
  }
  function applyVV() {
    var vv = window.visualViewport;
    if (vv) panel.style.setProperty("--vv-h", vv.height + "px");
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { if (isOpen) applyVV(); });
    window.visualViewport.addEventListener("scroll", function () { if (isOpen) applyVV(); });
  }

  // teaser (typewriter + pulse ring), shown after a delay
  var teaserDismissed = false;
  try { teaserDismissed = sessionStorage.getItem(TKEY) === "1"; } catch (e) {}
  function showTeaser() {
    if (teaserDismissed || isOpen) return;
    teaser.style.display = "flex";
    ring.style.display = "block";
    var i = 0;
    tt.innerHTML = "";
    var cur = document.createElement("span");
    cur.className = "cur";
    tt.parentNode.insertBefore(cur, tt.nextSibling);
    var id = setInterval(function () {
      i++;
      tt.textContent = cfg.teaser.slice(0, i);
      if (i >= cfg.teaser.length) { clearInterval(id); if (cur.parentNode) cur.parentNode.removeChild(cur); }
    }, 30);
  }
  function hideTeaser() { teaser.style.display = "none"; ring.style.display = "none"; }
  function dismissTeaser() {
    teaserDismissed = true;
    hideTeaser();
    try { sessionStorage.setItem(TKEY, "1"); } catch (e) {}
  }
  teaser.addEventListener("click", function () { dismissTeaser(); setOpen(true); });
  $(".teaser .tx").addEventListener("click", function (e) { e.stopPropagation(); dismissTeaser(); });
  setTimeout(showTeaser, 2500);

  // tiny safe markdown: escape, then links + bold
  function render(text) {
    var e = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    e = e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + t + "</a>";
    });
    return e.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }
  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }
  function addMsg(role, text) {
    var row = document.createElement("div");
    row.className = "row " + role;
    var bub = document.createElement("div");
    bub.className = "bub";
    bub.innerHTML = render(text);
    row.appendChild(bub);
    msgs.appendChild(row);
    scrollDown();
    return bub;
  }
  function addEffect(type) {
    var d = document.createElement("div");
    d.className = "eff";
    d.textContent =
      type === "lead_captured"
        ? (al ? "✓ Të dhënat u ruajtën — do t'ju kontaktojmë së shpejti" : "✓ Details saved — we'll be in touch soon")
        : (al ? "✓ Po ju lidhim me një person" : "✓ Connecting you to a person");
    msgs.appendChild(d);
    scrollDown();
  }

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
    sendBtn.disabled = !input.value.trim();
  });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submit(); }
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); submit(); });

  var busy = false;
  function submit() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    history.push({ role: "user", content: text });
    persist();
    addMsg("u", text);
    stream(text);
  }

  async function stream(message) {
    busy = true;
    var typing = document.createElement("div");
    typing.className = "typing";
    typing.innerHTML = '<div class="b"><span></span><span></span><span></span></div>';
    msgs.appendChild(typing);
    scrollDown();
    var bub = null, acc = "";
    var entry = { role: "assistant", content: "" };
    function ensureBubble() {
      if (!bub) { if (typing.parentNode) typing.parentNode.removeChild(typing); bub = addMsg("a", ""); }
    }
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
          var evName = "message", data = "";
          var lines = parts[i].split("\n");
          for (var j = 0; j < lines.length; j++) {
            if (lines[j].indexOf("event:") === 0) evName = lines[j].slice(6).trim();
            else if (lines[j].indexOf("data:") === 0) data += lines[j].slice(5).trim();
          }
          var payload = {};
          try { payload = JSON.parse(data); } catch (e) {}
          if (evName === "meta" && payload.conversationId) conversationId = payload.conversationId;
          else if (evName === "text" && payload.delta) {
            ensureBubble();
            acc += payload.delta;
            entry.content = acc;
            bub.innerHTML = render(acc);
            scrollDown();
          } else if (evName === "effect" && payload.type) addEffect(payload.type);
          else if (evName === "error") throw new Error(payload.message || "error");
        }
      }
      ensureBubble();
      if (!acc) {
        acc = al ? "Më vjen keq, diçka shkoi keq. Provo përsëri." : "Sorry, something went wrong. Please try again.";
        entry.content = acc;
        bub.innerHTML = render(acc);
      }
      history.push(entry);
      persist();
    } catch (err) {
      ensureBubble();
      bub.innerHTML = render(al ? "Lidhja dështoi. Provo përsëri." : "Connection failed. Please try again.");
    } finally {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      busy = false;
      sendBtn.disabled = !input.value.trim();
      input.focus();
    }
  }
})();
