/**
 * Lidh.al embeddable chat widget.
 *
 * One line on the host site:
 *   <script src="https://app.lidh.al/widget.js" data-tenant="acme-coffee" defer></script>
 *
 * Floating bubble + panel, isolated in a Shadow DOM (host CSS can't break it),
 * talking to the public streaming endpoint POST {api}/v1/chat/web over SSE.
 *
 * data-* on the script tag:
 *   data-tenant   (required) tenant slug
 *   data-api      API base       (default https://api.lidh.al)
 *   data-title    panel title    (default "Asistenti")
 *   data-locale   reply locale   (default al)
 *   data-greeting opening message shown when the panel opens
 *   data-teaser   launcher tooltip text (default localized "Questions? Chat with us")
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
      (al
        ? "Përshëndetje! 👋 Si mund t'ju ndihmoj sot?"
        : "Hi! 👋 How can I help you today?"),
    teaser:
      script.getAttribute("data-teaser") ||
      (al ? "Pyetje? Bisedo me ne 👋" : "Questions? Chat with us 👋"),
    subtitle: al ? "Online tani — përgjigje në sekonda" : "Online now — replies in seconds",
  };
  if (!cfg.tenant) {
    console.error("[lidh] widget: missing data-tenant");
    return;
  }

  // Brand gradient (deep blue → cyan), used on the launcher, header and send.
  var GRAD = "linear-gradient(135deg,#243b8f 0%,#2f63c4 48%,#3fc2e3 100%)";

  var SKEY = "lidh:wsess:" + cfg.tenant;
  var GKEY = "lidh:wteaser:" + cfg.tenant;
  var sessionRef =
    localStorage.getItem(SKEY) ||
    "w_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(SKEY, sessionRef);
  var conversationId = null;

  var host = document.createElement("div");
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var CHAT_SVG =
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1L4 21l3.9-1.3c1.3.4 2.7.6 4.1.6 5.5 0 10-3.8 10-8.8S17.5 3 12 3z"/></svg>';
  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SEND_SVG =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}" +
    // launcher + teaser
    ".dock{position:fixed;bottom:22px;right:22px;z-index:2147483647;display:flex;align-items:center;gap:12px}" +
    ".teaser{display:flex;align-items:center;gap:10px;background:#fff;color:#1e293b;font-size:14px;font-weight:500;padding:11px 16px;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.14);white-space:nowrap}" +
    ".teaser button{border:none;background:transparent;color:#94a3b8;font-size:17px;line-height:1;cursor:pointer;padding:0}" +
    ".launch{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:" + GRAD + ";box-shadow:0 10px 28px rgba(37,99,235,.4);display:flex;align-items:center;justify-content:center;transition:transform .15s}" +
    ".launch:hover{transform:scale(1.06)}" +
    // panel
    ".panel{position:fixed;bottom:96px;right:22px;z-index:2147483647;width:384px;max-width:calc(100vw - 32px);height:564px;max-height:calc(100vh - 130px);background:#fff;border-radius:20px;box-shadow:0 18px 50px rgba(2,32,71,.26);display:none;flex-direction:column;overflow:hidden}" +
    ".panel.open{display:flex;animation:pop .18s ease-out}" +
    "@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
    ".head{background:" + GRAD + ";color:#fff;padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between}" +
    ".head .t{font-size:16px;font-weight:700;line-height:1.2}" +
    ".head .s{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.92;margin-top:3px}" +
    ".head .s i{width:8px;height:8px;border-radius:50%;background:#3ddc84;display:inline-block;box-shadow:0 0 0 3px rgba(61,220,132,.25)}" +
    ".head .x{background:transparent;border:none;color:#fff;cursor:pointer;opacity:.9;padding:2px;display:flex}" +
    // messages
    ".msgs{flex:1;overflow-y:auto;padding:18px;background:#f6f9fc;display:flex;flex-direction:column;gap:12px}" +
    ".row{display:flex;max-width:100%}.row.u{justify-content:flex-end}" +
    ".bub{max-width:82%;padding:11px 15px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}" +
    ".row.a .bub{background:#fff;color:#1e293b;border-radius:16px 16px 16px 4px;box-shadow:0 1px 2px rgba(15,23,42,.06)}" +
    ".row.u .bub{background:#2f63c4;color:#fff;border-radius:16px 16px 4px 16px}" +
    ".bub a{color:inherit;text-decoration:underline}.row.a .bub a{color:#2f63c4}" +
    ".eff{align-self:center;font-size:12px;color:#475569;background:#e8f0fe;padding:5px 12px;border-radius:999px}" +
    ".dots span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#9aa7bd;margin:0 2px;animation:b 1s infinite}" +
    ".dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}" +
    "@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}" +
    // footer / input
    ".foot{padding:12px;display:flex;gap:9px;align-items:flex-end;background:#fff;border-top:1px solid #eef2f7}" +
    ".foot textarea{flex:1;resize:none;border:1.5px solid #d3deec;border-radius:14px;padding:11px 14px;font-size:14px;line-height:1.4;max-height:96px;outline:none;color:#1e293b}" +
    ".foot textarea:focus{border-color:#3f7fe0}" +
    ".foot .send{flex:none;width:44px;height:44px;border:none;border-radius:13px;cursor:pointer;background:" + GRAD + ";display:flex;align-items:center;justify-content:center;transition:opacity .15s}" +
    ".foot .send:disabled{opacity:.45;cursor:default}" +
    ".credit{text-align:center;font-size:11px;color:#9aa7bd;padding:0 0 9px}" +
    "</style>" +
    '<div class="dock">' +
    '<div class="teaser"><span></span><button class="teaser-x" aria-label="Dismiss">×</button></div>' +
    '<button class="launch" aria-label="Chat">' + CHAT_SVG + "</button>" +
    "</div>" +
    '<div class="panel" role="dialog">' +
    '<div class="head"><div><div class="t"></div><div class="s"><i></i><span></span></div></div>' +
    '<button class="x" aria-label="Close">' + CLOSE_SVG + "</button></div>" +
    '<div class="msgs"></div>' +
    '<div class="foot"><textarea rows="1" placeholder="' + (al ? "Shkruaj mesazhin..." : "Type your message...") + '"></textarea>' +
    '<button class="send" aria-label="Send">' + SEND_SVG + "</button></div>" +
    '<div class="credit">Powered by Lidh.al</div>' +
    "</div>";

  var $ = function (s) { return root.querySelector(s); };
  $(".teaser span").textContent = cfg.teaser;
  $(".head .t").textContent = cfg.title;
  $(".head .s span").textContent = cfg.subtitle;

  var dock = $(".dock"),
    teaser = $(".teaser"),
    launch = $(".launch"),
    panel = $(".panel"),
    msgs = $(".msgs"),
    input = $(".foot textarea"),
    sendBtn = $(".send");

  if (localStorage.getItem(GKEY) === "1") teaser.style.display = "none";

  function setOpen(isOpen) {
    if (isOpen) {
      panel.classList.add("open");
      launch.innerHTML = CLOSE_SVG;
      teaser.style.display = "none";
      if (cfg.greeting && !msgs.children.length) addMsg("a", cfg.greeting);
      setTimeout(function () { input.focus(); }, 60);
    } else {
      panel.classList.remove("open");
      launch.innerHTML = CHAT_SVG;
    }
  }
  launch.addEventListener("click", function () {
    setOpen(!panel.classList.contains("open"));
  });
  $(".x").addEventListener("click", function () { setOpen(false); });
  $(".teaser-x").addEventListener("click", function () {
    teaser.style.display = "none";
    localStorage.setItem(GKEY, "1");
  });

  // tiny safe markdown: escape, then links + bold + line breaks
  function render(text) {
    var e = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    e = e.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + t + "</a>";
    });
    return e.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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
        ? (al ? "✓ Të dhënat u ruajtën" : "✓ Details saved")
        : (al ? "✓ Po ju lidhim me një person" : "✓ Connecting you to a person");
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 96) + "px";
  });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); submit(); }
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
    var bub = addMsg("a", "");
    bub.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
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
            acc += payload.delta;
            bub.innerHTML = render(acc);
            msgs.scrollTop = msgs.scrollHeight;
          } else if (evName === "effect" && payload.type) addEffect(payload.type);
          else if (evName === "error") throw new Error(payload.message || "error");
        }
      }
      if (!acc)
        bub.innerHTML = render(al ? "Më vjen keq, diçka shkoi keq. Provo përsëri." : "Sorry, something went wrong. Please try again.");
    } catch (err) {
      bub.innerHTML = render(al ? "Lidhja dështoi. Provo përsëri." : "Connection failed. Please try again.");
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }
})();
