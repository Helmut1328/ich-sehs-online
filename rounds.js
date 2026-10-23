(() => {
  const cfg = window.GAME_CONFIG || {};
  const baseUrl = (cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  let roomCode = "", playerName = "", isHost = false, refreshTimer = null, refreshing = false;

  async function rpc(name, args) {
    if (!baseUrl || !key) throw new Error("Supabase-Konfiguration fehlt.");
    const res = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {"Content-Type":"application/json", apikey:key, Authorization:`Bearer ${key}`},
      body: JSON.stringify(args)
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!res.ok) throw new Error(data && typeof data === "object" ? (data.message || data.details || data.hint || JSON.stringify(data)) : String(data || `HTTP ${res.status}`));
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
    .rounds-answer{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #e9e5f6}
    .rounds-answer b,.rounds-answer small{display:block}.rounds-answer small{color:#79758d;margin-top:4px}
    .rounds-image{display:block;max-width:100%;max-height:360px;object-fit:contain;border-radius:12px;margin:14px auto}
    .rounds-status{font-size:11px;font-weight:800;border-radius:999px;padding:7px 10px;background:#e2f9ec;color:#168352}
    .rounds-reactions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .rounds-reaction{border:1px solid #e2def2;background:#fff;border-radius:10px;padding:7px 10px;cursor:pointer;font-size:18px;line-height:1.2}
    .rounds-reaction.selected{border-color:#6c4cf1;background:#eeeaff;box-shadow:0 0 0 1px #6c4cf1}
    .rounds-reaction:disabled{opacity:.55;cursor:default}
    .rounds-waiting{padding:12px;border-radius:12px;background:#fff7e6;color:#79521a;font-size:13px;line-height:1.5}
    .rounds-file-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
    .rounds-file-row input[type=file]{max-width:100%;font-size:12px}
    .rounds-preview{display:block;max-width:100%;max-height:220px;object-fit:contain;border-radius:12px;margin:10px 0}
    #open-counter-widget{font-size:11px;color:#9893a9;font-variant-numeric:tabular-nums}
    @media(max-width:650px){.rounds-answer{flex-direction:column}.rounds-answer .rounds-btn{width:100%}}
  `;
  document.head.appendChild(style);

  async function loadCounter() {
    const el = $("#open-counter-widget"); if (!el) return;
    try { const n = await rpc("get_game_open_count", {}); el.textContent = `Programm geöffnet: ${Number(n || 0).toLocaleString("de-DE")} mal`; }
    catch (_) { el.textContent = "Öffnungszähler wird vorbereitet"; }
  }
  function addCounter() {
    const footer = $("footer"); if (!footer || $("#open-counter-widget")) return;
    const el = document.createElement("span"); el.id = "open-counter-widget"; el.textContent = "Programm geöffnet: … mal"; footer.appendChild(el);
    loadCounter(); window.setInterval(loadCounter, 20000);
  }
  function detectHost(panel, name) {
    const target = String(name || "").trim().toLocaleLowerCase();
    const rows = $$(".room-player", panel);
    if (!target || !rows.length) return false;
    const tagged = rows.find(row => $(".you-tag", row)?.textContent.trim().toUpperCase() === "HOST" &&
      $("b", row)?.textContent.trim().toLocaleLowerCase() === target);
    if (tagged) return true;
    return $("b", rows[0])?.textContent.trim().toLocaleLowerCase() === target &&
      /Gastgeber/i.test($("small", rows[0])?.textContent || "");
  }
  function addRoundPanel() {
    const panel = $("#room-panel"); if (!panel || $("#rounds-panel")) return;
    const section = document.createElement("section"); section.id = "rounds-panel";
    section.innerHTML = `
      <div class="rounds-top"><div><p class="eyebrow">SPIELRUNDE</p><h3 id="rounds-title">Noch keine Runde gestartet</h3></div><span class="rounds-status">Online</span></div>
      <div id="rounds-setup">
        <p class="rounds-hint">Der Rundenleiter gibt einen Hinweis und die richtige Lösung vor. Das Bild kann direkt vom Handy oder Computer ausgewählt werden.</p>
        <label class="rounds-field" for="rounds-image-file">Bild aus Galerie / Dateien auswählen (optional)</label>
        <div class="rounds-file-row"><input id="rounds-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"><button id="rounds-upload" class="rounds-btn secondary" type="button">Bild hochladen</button></div>
        <p id="rounds-upload-message" class="rounds-hint" role="status">Maximal 8 MB. Das Bild wird mit der Spielrunde geteilt.</p>
        <img id="rounds-upload-preview" class="rounds-preview" alt="Vorschau des ausgewählten Bildes" hidden>
        <label class="rounds-field" for="rounds-image-url">Oder Bild-URL verwenden (optional)</label><input id="rounds-image-url" class="rounds-input" type="url" placeholder="https://…">
        <label class="rounds-field" for="rounds-clue">Hinweis für die Mitspieler</label><input id="rounds-clue" class="rounds-input" maxlength="180" placeholder="z. B. Es ist rund und kann rollen">
        <label class="rounds-field" for="rounds-solution">Richtige Lösung (bleibt für Mitspieler geheim)</label><input id="rounds-solution" class="rounds-input" maxlength="100" placeholder="Nur der Rundenleiter sieht die Lösung">
        <button id="rounds-start" class="rounds-btn" type="button">Runde starten</button>
      </div>
      <div id="rounds-play" hidden>
        <img id="rounds-image" class="rounds-image" alt="Bild der Spielrunde" hidden><p id="rounds-clue-display" class="rounds-clue"></p>
        <div id="rounds-answer-entry"><label class="rounds-field" for="rounds-answer">Deine Antwort</label><input id="rounds-answer" class="rounds-input" maxlength="100" placeholder="Was vermutest du?"><button id="rounds-submit" class="rounds-btn secondary" type="button">Antwort senden</button></div>
        <p class="rounds-field">Antworten der Mitspieler</p><p id="rounds-reveal-status" class="rounds-waiting" hidden></p><div id="rounds-answers"></div><p id="rounds-solution-display" class="rounds-hint"></p>
        <button id="rounds-finish" class="rounds-btn secondary" type="button">Runde beenden</button>
      </div><p id="rounds-message" class="rounds-hint" role="status"></p>`;
    const actions = $(".room-actions", panel); if (actions) actions.before(section); else panel.appendChild(section);
    $("#rounds-start").addEventListener("click", startRound);
    $("#rounds-submit").addEventListener("click", submitAnswer);
    $("#rounds-finish").addEventListener("click", finishRound);
    $("#rounds-upload").addEventListener("click", uploadImage);
    $("#rounds-image-file").addEventListener("change", previewSelectedImage);
  }
  function message(text, error = false) {
    const el = $("#rounds-message"); if (el) { el.textContent = text; el.style.color = error ? "#c13d61" : "#79758d"; }
  }
  function uploadMessage(text, error = false) {
    const el = $("#rounds-upload-message"); if (el) { el.textContent = text; el.style.color = error ? "#c13d61" : "#79758d"; }
  }
  function previewSelectedImage() {
    const file = $("#rounds-image-file")?.files?.[0], preview = $("#rounds-upload-preview");
    if (!file || !preview) { if (preview) preview.hidden = true; return; }
    if (!file.type.startsWith("image/")) { uploadMessage("Bitte eine Bilddatei auswählen.", true); return; }
    if (file.size > 8 * 1024 * 1024) { uploadMessage("Das Bild ist größer als 8 MB. Bitte ein kleineres Bild wählen.", true); return; }
    preview.src = URL.createObjectURL(file); preview.hidden = false;
    uploadMessage(`${file.name} ausgewählt (${(file.size / 1024 / 1024).toFixed(1)} MB). Klicke auf „Bild hochladen“.`);
  }
  async function uploadImage() {
    const file = $("#rounds-image-file")?.files?.[0];
    if (!file) return uploadMessage("Bitte zuerst ein Bild aus deiner Galerie auswählen.", true);
    if (file.size > 8 * 1024 * 1024) return uploadMessage("Das Bild ist größer als 8 MB. Bitte ein kleineres Bild wählen.", true);
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return uploadMessage("Bitte JPG, PNG, WEBP, GIF oder AVIF verwenden.", true);
    const button = $("#rounds-upload"); button.disabled = true; button.textContent = "Wird hochgeladen …";
    try {
      const body = new FormData(); body.append("image", file); body.append("code", roomCode); body.append("player_name", playerName);
      const response = await fetch(`${baseUrl}/functions/v1/upload-round-image`, {method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`},body});
      const raw = await response.text(); let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {error:raw}; }
      if (!response.ok) throw new Error(data.error || data.message || `Upload fehlgeschlagen (HTTP ${response.status})`);
      $("#rounds-image-url").value = data.url; uploadMessage("Bild erfolgreich hochgeladen. Es wird mit der Runde geteilt.");
      message("Bild bereit. Fülle Hinweis und Lösung aus und starte die Runde.");
    } catch (e) { uploadMessage(`Bild-Upload nicht möglich: ${e.message}`, true); }
    finally { button.disabled = false; button.textContent = "Bild hochladen"; }
  }
  async function inspectRoom() {
    const panel = $("#room-panel");
    if (!panel || panel.classList.contains("hidden")) {
      if (refreshTimer) clearInterval(refreshTimer); refreshTimer = null; roomCode = ""; playerName = ""; isHost = false; return;
    }
    const code = ($("#shown-code")?.textContent || "").trim(), name = ($("#player-name")?.value || "").trim();
    if (!code || code === "———" || !name) return;
    const changed = code !== roomCode || name !== playerName;
    roomCode = code; playerName = name; isHost = detectHost(panel, name);
    addRoundPanel();
    if (changed) refreshRound();
    if (!refreshTimer) refreshTimer = window.setInterval(refreshRound, 5000);
  }
  async function refreshRound() {
    if (!roomCode || !playerName || !$("#rounds-panel") || refreshing) return;
    refreshing = true;
    try { renderRound(await rpc("get_game_round", {p_code:roomCode,p_player_name:playerName})); }
    catch (e) {
      const msg = String(e.message || "").toLowerCase();
      if (msg.includes("keine runde") || msg.includes("not found") || msg.includes("no rows")) {
        $("#rounds-title").textContent = "Noch keine Runde gestartet"; $("#rounds-play").hidden = true; $("#rounds-setup").hidden = !isHost;
      } else console.warn("Rundenstatus:", e.message);
    } finally { refreshing = false; }
  }
  function renderRound(round) {
    if (Array.isArray(round)) round = round[0] || null;
    if (!round) { $("#rounds-title").textContent = "Noch keine Runde gestartet"; $("#rounds-play").hidden = true; $("#rounds-setup").hidden = !isHost; return; }
    const status = round.status || "active";
    const nextHost = String(round.next_host_name || "").trim().toLocaleLowerCase();
    const isNextHost = status === "finished" && nextHost && nextHost === playerName.trim().toLocaleLowerCase();
    isHost = Boolean(round.is_host) || Boolean(isNextHost);
    const revealed = Boolean(round.answers_revealed) || status === "finished";
    const allAnswered = Boolean(round.all_players_answered) || revealed;
    const canSeeAnswers = revealed || Boolean(round.is_host);
    $("#rounds-title").textContent = status === "finished" ? "Runde beendet" : (revealed ? "Antworten aufgedeckt" : "Runde läuft");
    $("#rounds-setup").hidden = !isHost || status === "active";
    $("#rounds-play").hidden = status !== "active" && status !== "finished";
    $("#rounds-clue-display").textContent = round.clue || "";
    const image = $("#rounds-image");
    if (round.image_url) { image.src = round.image_url; image.hidden = false; image.onerror = () => { image.hidden = true; }; }
    else { image.removeAttribute("src"); image.hidden = true; }
    $("#rounds-answer-entry").hidden = Boolean(round.is_host) || status !== "active" || Boolean(round.my_answer_submitted);
    $("#rounds-finish").hidden = !Boolean(round.is_host) || status !== "active" || !allAnswered;
    const revealStatus = $("#rounds-reveal-status");
    revealStatus.hidden = canSeeAnswers;
    revealStatus.textContent = canSeeAnswers ? "" : "Deine Antwort ist abgegeben? Warte, bis alle Mitspieler geantwortet haben. Erst dann werden die Antworten für alle sichtbar.";
    $("#rounds-solution-display").textContent = round.secret_answer ? `Richtige Lösung: ${round.secret_answer}` : (status === "finished" ? "Die Runde ist beendet." : "");
    const list = $("#rounds-answers"); list.replaceChildren();
    if (!canSeeAnswers) return;
    (round.answers || []).forEach(answer => {
      const row = document.createElement("div"); row.className = "rounds-answer";
      const info = document.createElement("span"), name = document.createElement("b"), value = document.createElement("small");
      name.textContent = answer.player_name;
      value.textContent = `${answer.answer} · ${answer.is_correct ? "Richtig ✓" : answer.reviewed ? "Falsch ✕" : "Noch nicht bewertet"}`;
      info.append(name, value);
      if (Array.isArray(answer.reactions) && answer.reactions.length) {
        const counts = answer.reactions.reduce((acc, item) => { acc[item.emoji] = (acc[item.emoji] || 0) + 1; return acc; }, {});
        const summary = document.createElement("small");
        summary.textContent = Object.entries(counts).map(([emoji,count]) => `${emoji} ${count}`).join(" · "); info.appendChild(summary);
      }
      row.appendChild(info);
      if (revealed && !Boolean(round.is_host) && status === "active") {
        const reactions = document.createElement("div"); reactions.className = "rounds-reactions";
        reactions.setAttribute("aria-label", `Emoji-Reaktion auf die Antwort von ${answer.player_name}`);
        ["😂","👍","👎","❤️","🤔"].forEach(emoji => {
          const button = document.createElement("button"); button.type = "button"; button.className = "rounds-reaction"; button.textContent = emoji; button.title = `Mit ${emoji} reagieren`;
          if (answer.my_reaction === emoji) button.classList.add("selected");
          button.addEventListener("click", async () => {
            reactions.querySelectorAll("button").forEach(b => b.disabled = true);
            try { await rpc("set_game_answer_reaction", {p_code:roomCode,p_player_name:playerName,p_answer_player_name:answer.player_name,p_reaction:emoji}); await refreshRound(); }
            catch (e) { message(e.message,true); reactions.querySelectorAll("button").forEach(b => b.disabled = false); }
          });
          reactions.appendChild(button);
        });
        row.appendChild(reactions);
      }
      if (Boolean(round.is_host) && allAnswered && !answer.reviewed && answer.answer && status === "active") {
        const actions = document.createElement("div"); actions.className = "rounds-reactions";
        const correct = document.createElement("button"); correct.className = "rounds-btn secondary"; correct.textContent = "✓ Richtig";
        correct.addEventListener("click", async () => { try { await rpc("mark_game_answer_correct",{p_code:roomCode,p_host_name:playerName,p_answer_player_name:answer.player_name}); await refreshRound(); } catch(e) { message(e.message,true); } });
        const wrong = document.createElement("button"); wrong.className = "rounds-btn secondary"; wrong.textContent = "✕ Falsch";
        wrong.addEventListener("click", async () => { try { await rpc("mark_game_answer_wrong",{p_code:roomCode,p_host_name:playerName,p_answer_player_name:answer.player_name}); await refreshRound(); } catch(e) { message(e.message,true); } });
        actions.append(correct,wrong); row.appendChild(actions);
      }
      list.appendChild(row);
    });
  }
  async function startRound() {
    const clue = $("#rounds-clue").value.trim(), solution = $("#rounds-solution").value.trim();
    if (!clue || !solution) return message("Bitte Hinweis und richtige Lösung ausfüllen.",true);
    const button = $("#rounds-start"); button.disabled = true;
    try {
      await rpc("start_game_round",{p_code:roomCode,p_player_name:playerName,p_mode:$(".mode-card.selected")?.dataset.mode||"see",p_clue:clue,p_secret_answer:solution,p_image_url:$("#rounds-image-url").value.trim()||null});
      message("Die Runde läuft. Die Mitspieler können antworten."); await refreshRound();
    } catch(e) { message("Runde konnte nicht gestartet werden: "+e.message,true); }
    finally { button.disabled = false; }
  }
  async function submitAnswer() {
    const answer = $("#rounds-answer").value.trim(); if (!answer) return message("Bitte zuerst eine Antwort eingeben.",true);
    try { await rpc("submit_game_answer",{p_code:roomCode,p_player_name:playerName,p_answer:answer}); $("#rounds-answer").value=""; message("Antwort abgegeben. Warte, bis alle Mitspieler geantwortet haben."); await refreshRound(); }
    catch(e) { message("Antwort konnte nicht gesendet werden: "+e.message,true); }
  }
  async function finishRound() {
    try { await rpc("finish_game_round",{p_code:roomCode,p_player_name:playerName}); message("Runde beendet. Der nächste Rundenleiter kann jetzt starten."); await refreshRound(); }
    catch(e) { message(e.message,true); }
  }
  addCounter();
  const observer = new MutationObserver(() => inspectRoom());
  const roomPanel = $("#room-panel");
  if (roomPanel) observer.observe(roomPanel,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
  window.setInterval(inspectRoom,1000); inspectRoom();
})();
