(() => {
  const cfg = window.GAME_CONFIG || {};
  const baseUrl = (cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  let lastRoomCode = "";
  let lastPlayerName = "";
  let isHost = false;
  let refreshTimer = null;
  let cleanQueued = false;

  async function rpc(name, args) {
    if (!baseUrl || !key) throw new Error("Supabase-Konfiguration fehlt.");
    const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify(args)
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      throw new Error(data && typeof data === "object"
        ? (data.message || data.details || data.hint || JSON.stringify(data))
        : String(data || `HTTP ${res.status}`));
    }
    return data;
  }

  const style = document.createElement("style");
  style.textContent = `
    #rounds-panel{border-top:1px solid #e9e5f6;margin-top:20px;padding-top:18px}
    #rounds-panel h3{font:700 18px Outfit,system-ui,sans-serif;margin:0}
    .rounds-top{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .rounds-hint{font-size:12px;line-height:1.5;color:#79758d}
    .rounds-field{margin:12px 0 7px;display:block;font-size:12px;font-weight:800}
    .rounds-input{width:100%;box-sizing:border-box;border:1.5px solid #e9e5f6;border-radius:12px;padding:12px;background:#fcfbff;font:inherit;color:#201b36}
    .rounds-btn{border:0;border-radius:12px;padding:12px 15px;background:#6c4cf1;color:white;font:700 13px system-ui;cursor:pointer;margin-top:12px}
    .rounds-btn.secondary{background:#eeeaff;color:#5033d1}
    .rounds-btn:disabled{opacity:.5}
    .rounds-clue{background:#f7f5ff;padding:14px;border-radius:12px;font-weight:700;line-height:1.5}
    .rounds-answer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #e9e5f6}
    .rounds-answer b,.rounds-answer small{display:block}.rounds-answer small{color:#79758d;margin-top:4px}
    .rounds-image{display:block;max-width:100%;max-height:360px;object-fit:contain;border-radius:12px;margin:14px auto}
    .rounds-status{font-size:11px;font-weight:800;border-radius:999px;padding:7px 10px;background:#e2f9ec;color:#168352}
    #open-counter-widget{font-size:11px;color:#9893a9;font-variant-numeric:tabular-nums}
    @media(max-width:650px){.rounds-answer{align-items:flex-start;flex-direction:column}.rounds-answer .rounds-btn{width:100%}}
  `;
  document.head.appendChild(style);

  function addCounter() {
    const footer = $("footer");
    if (!footer || $("#open-counter-widget")) return;
    const el = document.createElement("span");
    el.id = "open-counter-widget";
    el.textContent = "Programm geöffnet: … mal";
    footer.appendChild(el);
    loadCounter();
    window.setInterval(loadCounter, 20000);
  }

  async function loadCounter() {
    const el = $("#open-counter-widget");
    if (!el) return;
    try {
      const n = await rpc("get_game_open_count", {});
      el.textContent = `Programm geöffnet: ${Number(n || 0).toLocaleString("de-DE")} mal`;
    } catch (e) {
      el.textContent = "Öffnungszähler wird vorbereitet";
      console.warn("Öffnungszähler:", e.message);
    }
  }

  function cleanDuplicateLists() {
    const panel = $("#room-panel");
    if (!panel) return;
    const lists = $$("#room-player-list", panel);
    if (lists.length > 1) lists.slice(0, -1).forEach(el => el.remove());
    const headings = $$("p.field-label", panel).filter(el => /^Mitspieler \(/.test(el.textContent.trim()));
    if (headings.length > 1) headings.slice(0, -1).forEach(el => el.remove());
  }

  function addRoundPanel() {
    const panel = $("#room-panel");
    if (!panel || $("#rounds-panel")) return;
    const section = document.createElement("section");
    section.id = "rounds-panel";
    section.innerHTML = `
      <div class="rounds-top"><div><p class="eyebrow">SPIELRUNDE</p><h3 id="rounds-title">Noch keine Runde gestartet</h3></div><span class="rounds-status">Online</span></div>
      <div id="rounds-setup">
        <p class="rounds-hint">Der Gastgeber gibt einen Hinweis und die richtige Lösung vor. Das Bild ist optional.</p>
        <label class="rounds-field" for="rounds-image-url">Bild-URL (optional)</label>
        <input id="rounds-image-url" class="rounds-input" type="url" placeholder="https://…">
        <label class="rounds-field" for="rounds-clue">Hinweis für die Mitspieler</label>
        <input id="rounds-clue" class="rounds-input" maxlength="180" placeholder="z. B. Es ist rund und kann rollen">
        <label class="rounds-field" for="rounds-solution">Richtige Lösung (bleibt für Mitspieler geheim)</label>
        <input id="rounds-solution" class="rounds-input" maxlength="100" placeholder="Nur der Gastgeber sieht die Lösung">
        <button id="rounds-start" class="rounds-btn" type="button">Runde starten</button>
      </div>
      <div id="rounds-play" hidden>
        <img id="rounds-image" class="rounds-image" alt="Bild der Spielrunde" hidden>
        <p id="rounds-clue-display" class="rounds-clue"></p>
        <div id="rounds-answer-entry">
          <label class="rounds-field" for="rounds-answer">Deine Antwort</label>
          <input id="rounds-answer" class="rounds-input" maxlength="100" placeholder="Was vermutest du?">
          <button id="rounds-submit" class="rounds-btn secondary" type="button">Antwort senden</button>
        </div>
        <p class="rounds-field">Antworten der Mitspieler</p>
        <div id="rounds-answers"></div>
        <p id="rounds-solution-display" class="rounds-hint"></p>
        <button id="rounds-finish" class="rounds-btn secondary" type="button">Runde beenden</button>
      </div>
      <p id="rounds-message" class="rounds-hint" role="status"></p>`;
    const actions = $(".room-actions", panel);
    if (actions) actions.before(section);
    else panel.appendChild(section);

    $("#rounds-start").addEventListener("click", startRound);
    $("#rounds-submit").addEventListener("click", submitAnswer);
    $("#rounds-finish").addEventListener("click", finishRound);
  }

  function message(text, error = false) {
    const el = $("#rounds-message");
    if (el) {
      el.textContent = text;
      el.style.color = error ? "#c13d61" : "#79758d";
    }
  }

  function inspectRoom() {
    const panel = $("#room-panel");
    if (!panel || panel.classList.contains("hidden")) {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
      lastRoomCode = "";
      return;
    }
    const code = ($("#shown-code")?.textContent || "").trim();
    const player = ($("#shown-player")?.textContent || "").trim();
    if (!code || code === "———" || !player) return;
    const hostRow = $$(".room-player", panel).find(row =>
      $(".you-tag", row)?.textContent.trim() === "HOST" &&
      $("b", row)?.textContent.trim().toLowerCase() === player.toLowerCase()
    );
    const changed = code !== lastRoomCode || player !== lastPlayerName;
    lastRoomCode = code;
    lastPlayerName = player;
    isHost = Boolean(hostRow);
    addRoundPanel();
    cleanDuplicateLists();
    if (changed) refreshRound();
    if (!refreshTimer) refreshTimer = window.setInterval(refreshRound, 5000);
  }

  async function refreshRound() {
    if (!lastRoomCode || !lastPlayerName || !$("#rounds-panel")) return;
    try {
      const round = await rpc("get_game_round", { p_code: lastRoomCode, p_player_name: lastPlayerName });
      renderRound(round);
    } catch (e) {
      if (!String(e.message || "").toLowerCase().includes("keine runde")) {
        console.warn("Rundenstatus:", e.message);
      }
    }
  }

  function renderRound(round) {
    if (!round) {
      $("#rounds-title").textContent = "Noch keine Runde gestartet";
      $("#rounds-play").hidden = true;
      $("#rounds-setup").hidden = !isHost;
      return;
    }
    $("#rounds-title").textContent = round.status === "finished" ? "Runde beendet" : "Runde läuft";
    $("#rounds-setup").hidden = !isHost || round.status === "active";
    $("#rounds-play").hidden = round.status !== "active" && round.status !== "finished";
    $("#rounds-clue-display").textContent = round.clue || "";
    const image = $("#rounds-image");
    if (round.image_url) {
      image.src = round.image_url;
      image.hidden = false;
      image.onerror = () => { image.hidden = true; };
    } else {
      image.removeAttribute("src");
      image.hidden = true;
    }
    $("#rounds-answer-entry").hidden = isHost || round.status !== "active";
    $("#rounds-finish").hidden = !isHost || round.status !== "active";
    $("#rounds-solution-display").textContent = round.secret_answer
      ? `Richtige Lösung: ${round.secret_answer}`
      : (round.status === "finished" ? "Die Runde ist beendet." : "");
    const list = $("#rounds-answers");
    list.replaceChildren();
    (round.answers || []).forEach(answer => {
      const row = document.createElement("div");
      row.className = "rounds-answer";
      const info = document.createElement("span");
      const name = document.createElement("b");
      name.textContent = answer.player_name;
      const value = document.createElement("small");
      value.textContent = `${answer.answer} · ${answer.is_correct ? "Richtig ✓" : "Noch nicht bewertet"}`;
      info.append(name, value);
      row.appendChild(info);
      if (isHost && !answer.is_correct && answer.answer && round.status === "active") {
        const button = document.createElement("button");
        button.className = "rounds-btn secondary";
        button.textContent = "Als richtig markieren";
        button.addEventListener("click", async () => {
          try {
            await rpc("mark_game_answer_correct", { p_code: lastRoomCode, p_host_name: lastPlayerName, p_answer_player_name: answer.player_name });
            await refreshRound();
          } catch (e) { message(e.message, true); }
        });
        row.appendChild(button);
      }
      list.appendChild(row);
    });
  }

  async function startRound() {
    const clue = $("#rounds-clue").value.trim();
    const solution = $("#rounds-solution").value.trim();
    if (!clue || !solution) return message("Bitte Hinweis und richtige Lösung ausfüllen.", true);
    const button = $("#rounds-start");
    button.disabled = true;
    try {
      await rpc("start_game_round", {
        p_code: lastRoomCode,
        p_player_name: lastPlayerName,
        p_mode: document.querySelector(".mode-card.selected")?.dataset.mode || "see",
        p_clue: clue,
        p_secret_answer: solution,
        p_image_url: $("#rounds-image-url").value.trim() || null
      });
      message("Die Runde läuft. Die Mitspieler können antworten.");
      await refreshRound();
    } catch (e) { message("Runde konnte nicht gestartet werden: " + e.message, true); }
    finally { button.disabled = false; }
  }

  async function submitAnswer() {
    const answer = $("#rounds-answer").value.trim();
    if (!answer) return message("Bitte zuerst eine Antwort eingeben.", true);
    try {
      await rpc("submit_game_answer", { p_code: lastRoomCode, p_player_name: lastPlayerName, p_answer: answer });
      $("#rounds-answer").value = "";
      message("Antwort abgegeben. Warte auf die Bewertung des Gastgebers.");
      await refreshRound();
    } catch (e) { message("Antwort konnte nicht gesendet werden: " + e.message, true); }
  }

  async function finishRound() {
    try {
      await rpc("finish_game_round", { p_code: lastRoomCode, p_player_name: lastPlayerName });
      message("Runde beendet.");
      await refreshRound();
    } catch (e) { message(e.message, true); }
  }

  addCounter();
  const observer = new MutationObserver(() => {
    if (cleanQueued) return;
    cleanQueued = true;
    queueMicrotask(() => {
      cleanQueued = false;
      inspectRoom();
    });
  });
  const roomPanel = $("#room-panel");
  if (roomPanel) observer.observe(roomPanel, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  window.setInterval(inspectRoom, 1000);
  inspectRoom();
})();