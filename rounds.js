(() => {
  const cfg = window.GAME_CONFIG || {};
  const baseUrl = (cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  // Device-Pixel-Ratio für die Canvas-Auflösung; ohne diese Definition bricht resizeCanvas ab.
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  let roomCode = "", playerName = "", isHost = false, refreshTimer = null, refreshing = false;
  let targetCircle = null, targetDrawing = false, targetStart = null, targetResize = false, pointSubmitted = false;
  let clearedFinishedRoundKey = "";

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
    #rounds-panel{border-top:0;margin-top:20px;padding:22px;border:1px solid #e8e2ff;border-radius:21px;background:linear-gradient(180deg,#fff,#fdfcff);box-shadow:0 8px 25px #3c2b7208}
    #rounds-panel h3{font:800 25px Outfit,system-ui,sans-serif;margin:0;letter-spacing:-.035em}
    .rounds-top{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .rounds-hint{font-size:12px;line-height:1.5;color:#79758d}
    .rounds-field{margin:12px 0 7px;display:block;font-size:12px;font-weight:800}
    .rounds-input{width:100%;box-sizing:border-box;border:1.5px solid #e5dfff;border-radius:14px;padding:14px 15px;background:#fbfaff;font:inherit;color:#201b36}
    .rounds-btn{border:0;border-radius:13px;padding:12px 15px;background:#6948f5;color:white;font:700 13px system-ui;cursor:pointer;margin-top:12px;transition:transform .15s,box-shadow .15s}
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
    .rounds-mode-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
    .rounds-mode-options label{display:flex;gap:8px;align-items:flex-start;border:1px solid #e2def2;border-radius:12px;padding:10px;font-size:12px;line-height:1.4;cursor:pointer}
    .rounds-mode-options input{margin-top:2px}
    .rounds-check{display:flex;align-items:flex-start;gap:9px;margin:12px 0;font-size:13px;line-height:1.4}
    .rounds-target-editor{margin-top:12px;padding:16px;border:1px solid #e5dfff;border-radius:16px;background:#f7f5ff}
    .rounds-image-wrap{position:relative;display:block;width:max-content;max-width:100%;line-height:0;vertical-align:top;margin:12px auto}
    .rounds-image-wrap img{display:block;width:auto;height:auto;max-width:100%;max-height:520px;object-fit:contain;border-radius:10px}
    .rounds-image-wrap canvas{position:absolute;left:0;top:0;width:100%;height:100%;touch-action:pan-y;cursor:crosshair;padding:0;margin:0;border:0}
    .rounds-image-wrap.point-player canvas{touch-action:none}
    .rounds-top{padding-bottom:18px;border-bottom:1px solid #eeeaff;margin-bottom:18px}.rounds-top .eyebrow{background:#f0ebff;border-radius:999px;padding:7px 10px;display:inline-block}.rounds-hint{font-size:13px;line-height:1.55;color:#777493}.rounds-status{background:#e5fbef;color:#168352}.rounds-image{max-height:520px;border-radius:16px;box-shadow:0 8px 24px #2d225010}.rounds-clue{background:#f4f0ff;padding:17px;border:1px solid #e6ddff;border-radius:15px}.rounds-btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px #6948f52c}
    @media(max-width:760px){#rounds-panel{padding:16px}.rounds-panel h3{font-size:21px}.rounds-answer{flex-direction:column}.rounds-answer .rounds-btn{width:100%}.rounds-mode-options{grid-template-columns:1fr}}
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
        <p class="rounds-hint">Der jeweilige Rundenchef wählt für jede Runde selbst den Spielmodus. Alle Mitspieler sehen automatisch denselben Modus.</p>
        <label class="rounds-field" for="rounds-mode-select">Spielmodus für diese Runde</label><select id="rounds-mode-select" class="rounds-input"><option value="see">Ich sehe was …</option><option value="point">Finde das Detail</option></select>
        <label class="rounds-check"><input id="rounds-rotate-leader" type="checkbox" checked><span><b>Rundenchef wechselt nach jeder Runde</b><br>Deaktivieren, wenn derselbe Rundenchef alle Runden leiten soll.</span></label>
        <label class="rounds-field" for="rounds-image-file">Bild aus Galerie / Dateien auswählen (optional)</label>
        <div class="rounds-file-row"><input id="rounds-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"><button id="rounds-upload" class="rounds-btn secondary" type="button">Bild hochladen</button></div>
        <p id="rounds-upload-message" class="rounds-hint" role="status">Maximal 8 MB. Das Bild wird mit der Spielrunde geteilt.</p>
        <img id="rounds-upload-preview" class="rounds-preview" alt="Vorschau des ausgewählten Bildes" hidden>
        <label class="rounds-field" for="rounds-image-url">Oder Bild-URL verwenden (optional)</label><input id="rounds-image-url" class="rounds-input" type="url" placeholder="https://…">
        <label class="rounds-field" for="rounds-clue">Hinweis für die Mitspieler</label><input id="rounds-clue" class="rounds-input" maxlength="180" placeholder="z. B. Es ist rund und kann rollen">
        <label class="rounds-field" for="rounds-solution">Richtige Lösung / optionale Bezeichnung</label><input id="rounds-solution" class="rounds-input" maxlength="100" placeholder="Nur der Rundenleiter sieht die Lösung">
        <div id="rounds-target-editor" class="rounds-target-editor" hidden>
          <p class="rounds-hint"><b>Zielkreis festlegen:</b> Ziehe auf dem Bild einen Kreis auf. Ziehe anschließend den Randgriff, um den Kreis größer oder kleiner zu machen. Der Kreis bleibt für Mitspieler bis zur Auswertung verborgen.</p>
          <div id="rounds-target-editor-wrap" class="rounds-image-wrap"><img id="rounds-target-image" alt="Bild zum Festlegen des Zielkreises" hidden><canvas id="rounds-target-canvas" aria-label="Zielkreis einzeichnen"></canvas></div>
          <p id="rounds-target-status" class="rounds-hint">Wähle zuerst ein Bild aus und ziehe dann den Zielkreis auf.</p>
        </div>
        <button id="rounds-start" class="rounds-btn" type="button">Runde starten</button>
      </div>
      <div id="rounds-play" hidden>
        <img id="rounds-image" class="rounds-image" alt="Bild der Spielrunde" hidden>
        <div id="rounds-point-play" hidden>
          <div id="rounds-point-wrap" class="rounds-image-wrap"><img id="rounds-point-image" alt="Bild zum Setzen deines Tipps" hidden><canvas id="rounds-point-canvas" aria-label="Tippe auf die vermutete Stelle"></canvas></div>
          <p id="rounds-point-status" class="rounds-hint">Tippe auf die Stelle, die du vermutest.</p>
        </div>
        <p id="rounds-clue-display" class="rounds-clue"></p>
        <div id="rounds-answer-entry"><label class="rounds-field" for="rounds-answer">Deine Antwort</label><input id="rounds-answer" class="rounds-input" maxlength="100" placeholder="Was vermutest du?"><button id="rounds-submit" class="rounds-btn secondary" type="button">Antwort senden</button></div>
        <p class="rounds-field">Antworten der Mitspieler</p><p id="rounds-reveal-status" class="rounds-waiting" hidden></p><div id="rounds-answers"></div><p id="rounds-solution-display" class="rounds-hint"></p>
        <button id="rounds-finish" class="rounds-btn secondary" type="button">Runde beenden</button>
      </div><p id="rounds-message" class="rounds-hint" role="status"></p>`;
    const actions = $(".room-actions", panel); if (actions) actions.before(section); else panel.appendChild(section);
    $("#rounds-start").addEventListener("click", startRound);
    $("#rounds-mode-select").addEventListener("change", updateModeSetup);
    // Modusauswahl erfolgt ausschließlich in der Vorbereitung jeder einzelnen Runde.
    $("#rounds-mode-select").value = "see";
    $("#rounds-submit").addEventListener("click", submitAnswer);
    $("#rounds-finish").addEventListener("click", finishRound);
    $("#rounds-upload").addEventListener("click", uploadImage);
    $("#rounds-image-file").addEventListener("change", previewSelectedImage);
    $("#rounds-image-url").addEventListener("input", syncTargetImage);
    $("#rounds-target-canvas").addEventListener("pointerdown", targetPointerDown);
    $("#rounds-target-canvas").addEventListener("pointermove", targetPointerMove);
    $("#rounds-target-canvas").addEventListener("pointerup", targetPointerUp);
    $("#rounds-target-canvas").addEventListener("pointercancel", targetPointerUp);
    $("#rounds-point-canvas").addEventListener("pointerdown", pointPointerDown);
    updateModeSetup();
  }

  function selectedMode() {
    // Der Rundenchef wählt den Modus für jede Runde neu; der gespeicherte Rundendatensatz synchronisiert ihn mit allen Spielern.
    const chosen = $("#rounds-mode-select")?.value || $(".mode-card.selected")?.dataset.mode || "see";
    return chosen === "detail" || chosen === "point" ? "point" : "see";
  }
  function updateModeSetup() {
    const pointMode = selectedMode() === "point";
    $("#rounds-target-editor").hidden = !pointMode;
    const solutionLabel = $('label[for="rounds-solution"]');
    if (solutionLabel) solutionLabel.textContent = pointMode ? "Bezeichnung (optional)" : "Richtige Lösung (bleibt geheim)";
    if (pointMode) syncTargetImage();
  }
  function syncTargetImage() {
    const file = $("#rounds-image-file")?.files?.[0];
    const img = $("#rounds-target-image");
    if (!img) return;
    const src = file && $("#rounds-upload-preview")?.src ? $("#rounds-upload-preview").src : ($("#rounds-image-url")?.value.trim() || "");
    if (src && img.src !== src) {
      img.onload = () => { resizeCanvas($("#rounds-target-canvas"), img); drawTargetCircle(); };
      img.src = src; img.hidden = false;
    } else if (src) { img.hidden = false; resizeCanvas($("#rounds-target-canvas"), img); drawTargetCircle(); }
    else { img.removeAttribute("src"); img.hidden = true; const c=$("#rounds-target-canvas"); if(c){c.width=1;c.height=1;} $("#rounds-target-status").textContent = "Wähle zuerst ein Bild aus und ziehe dann den Zielkreis auf."; }
  }
  function resizeCanvas(canvas, img) {
    if (!canvas || !img || !img.naturalWidth || !img.clientWidth) return;
    const rect = img.getBoundingClientRect();
    // Canvas muss pixelgenau über der tatsächlich sichtbaren Bildfläche liegen.
    const wrap = canvas.parentElement;
    if (wrap) { wrap.style.width = `${rect.width}px`; wrap.style.height = `${rect.height}px`; }
    canvas.width = Math.max(1, Math.round(rect.width*dpr));
    canvas.height = Math.max(1, Math.round(rect.height*dpr));
    canvas.style.left = "0px"; canvas.style.top = "0px";
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function drawTargetCircle() {
    const canvas=$("#rounds-target-canvas"), img=$("#rounds-target-image");
    if(!canvas||!img||img.hidden||!img.clientWidth) return;
    resizeCanvas(canvas,img);
    const rect=canvas.getBoundingClientRect();
    const ctx=canvas.getContext("2d"), w=rect.width, h=rect.height;
    ctx.clearRect(0,0,w,h);
    if(!targetCircle) return;
    // Zielkoordinaten sind immer relativ zur sichtbaren Bildfläche (0 bis 1).
    const x=targetCircle.x*w,y=targetCircle.y*h,r=targetCircle.r*Math.min(w,h);
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle="rgba(40,180,90,.18)";ctx.fill();
    ctx.lineWidth=3;ctx.strokeStyle="#19a05a";ctx.stroke();
    ctx.beginPath();ctx.arc(x+r*.707,y+r*.707,7,0,Math.PI*2);ctx.fillStyle="#19a05a";ctx.fill();
  }
  function targetPointerDown(e) {
    if(selectedMode()!=="point") return;
    const canvas=$("#rounds-target-canvas"), img=$("#rounds-target-image");
    if(!img||img.hidden||!img.clientWidth) return;
    e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
    const b=img.getBoundingClientRect(), x=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)), y=Math.max(0,Math.min(1,(e.clientY-b.top)/b.height));
    const w=b.width,h=b.height;
    let moveCircle = false;
    if(targetCircle){
      const cx=targetCircle.x*w,cy=targetCircle.y*h,rr=targetCircle.r*Math.min(w,h);
      const hx=cx+rr*.707,hy=cy+rr*.707;
      const px=e.clientX-b.left,py=e.clientY-b.top;
      targetResize=Math.hypot(px-hx,py-hy)<22;
      moveCircle=!targetResize && Math.hypot(px-cx,py-cy)<=rr;
    } else targetResize=false;
    targetDrawing=true;
    targetStart={x,y,px:e.clientX-b.left,py:e.clientY-b.top,moveCircle,original:targetCircle?{...targetCircle}:null};
    if(!targetResize&&!moveCircle) targetCircle={x,y,r:0.01};
  }
  function targetPointerMove(e) {
    if(!targetDrawing||!targetStart) return;
    const b=$("#rounds-target-image").getBoundingClientRect(), px=e.clientX-b.left,py=e.clientY-b.top;
    if(targetResize&&targetCircle){
      targetCircle.r=Math.max(.015,Math.min(.5,Math.hypot(px-targetCircle.x*b.width,py-targetCircle.y*b.height)/Math.min(b.width,b.height)));
    } else if(targetStart.moveCircle&&targetStart.original){
      targetCircle.x=Math.max(targetCircle.r,Math.min(1-targetCircle.r,targetStart.original.x+(px-targetStart.px)/b.width));
      targetCircle.y=Math.max(targetCircle.r,Math.min(1-targetCircle.r,targetStart.original.y+(py-targetStart.py)/b.height));
    } else {
      targetCircle.x=targetStart.x;targetCircle.y=targetStart.y;
      targetCircle.r=Math.max(.015,Math.min(.5,Math.hypot(px-targetStart.px,py-targetStart.py)/Math.min(b.width,b.height)));
    }
    drawTargetCircle();
    $("#rounds-target-status").textContent=`Zielkreis gesetzt. Radius: ${(targetCircle.r*100).toFixed(1)} % der kürzeren Bildseite.`;
  }
  function targetPointerUp() { targetDrawing=false;targetStart=null;targetResize=false; }
  async function pointPointerDown(e) {
    if (pointSubmitted) return;
    const currentRoundHost = $("#rounds-point-wrap")?.classList.contains("point-host");
    if (currentRoundHost) return;
    const roundMode = $("#rounds-point-play") && !$("#rounds-point-play").hidden;
    if(!roundMode) return;
    const canvas=$("#rounds-point-canvas"), img=$("#rounds-point-image"), b=img.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y=Math.max(0,Math.min(1,(e.clientY-b.top)/b.height));
    try {
      await rpc("submit_game_point",{p_code:roomCode,p_player_name:playerName,p_x:x,p_y:y});
      pointSubmitted=true;$("#rounds-point-status").textContent="Tipp abgegeben! Warte auf die anderen Mitspieler.";
      await refreshRound();
    } catch(err) { message(err.message,true); }
  }
  function drawPlayerPoint(round) {
    const canvas=$("#rounds-point-canvas"),img=$("#rounds-point-image");
    if(!canvas||!img||img.hidden||!img.clientWidth)return;
    resizeCanvas(canvas,img);
    const rect=canvas.getBoundingClientRect();
    const ctx=canvas.getContext("2d"),w=rect.width,h=rect.height;
    ctx.clearRect(0,0,w,h);
    const reveal=Boolean(round.answers_revealed)||round.status==="finished";
    if(reveal && round.target_x!=null && round.target_y!=null && round.target_radius!=null){
      const x=round.target_x*w,y=round.target_y*h,r=round.target_radius*Math.min(w,h);
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle="rgba(25,160,90,.18)";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#19a05a";ctx.stroke();
    }
    const points=Array.isArray(round.point_answers)?round.point_answers:[];
    if(reveal || round.is_host){
      points.forEach(p=>{
        if(p.x==null||p.y==null)return;
        ctx.beginPath();ctx.arc(p.x*w,p.y*h,6,0,Math.PI*2);
        ctx.fillStyle=p.is_correct?"#19a05a":"#d64747";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#fff";ctx.stroke();
      });
    }
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
    preview.onload = () => syncTargetImage();
    syncTargetImage();
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
      $("#rounds-image-url").value = data.url; syncTargetImage(); uploadMessage("Bild erfolgreich hochgeladen. Es wird mit der Runde geteilt.");
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
    if (!round) {
      $("#rounds-title").textContent="Noch keine Runde gestartet"; $("#rounds-play").hidden=true; $("#rounds-setup").hidden=!isHost;
      const staleImage=$("#rounds-image"); if(staleImage){staleImage.removeAttribute("src");staleImage.hidden=true;}
      const pointImage=$("#rounds-point-image"); if(pointImage){pointImage.removeAttribute("src");pointImage.hidden=true;}
      return;
    }
    const status=round.status||"active";
    const nextHost=String(round.next_host_name||"").trim().toLocaleLowerCase();
    const isNextHost=status==="finished"&&nextHost&&nextHost===playerName.trim().toLocaleLowerCase();
    isHost=Boolean(round.is_host)||Boolean(isNextHost);
    const revealed=Boolean(round.answers_revealed)||status==="finished";
    const allAnswered=Boolean(round.all_players_answered)||revealed;
    const pointMode=round.mode==="point";
    const canSeeAnswers=revealed||Boolean(round.is_host);
    const finishedRoundKey=String(round.id||round.created_at||`${round.room_code||roomCode}:${round.host_name||""}:${round.finished_at||"finished"}`);
    // Der nächste Rundenchef sieht nicht länger das Bild der alten Runde.
    // Die Vorbereitung wird genau einmal zurückgesetzt, nicht bei jedem Poll.
    if(status==="finished" && isNextHost && clearedFinishedRoundKey!==finishedRoundKey){
      clearedFinishedRoundKey=finishedRoundKey;
      const file=$("#rounds-image-file"), preview=$("#rounds-upload-preview");
      if(file) file.value="";
      if(preview){preview.removeAttribute("src");preview.hidden=true;}
      $("#rounds-image-url").value="";
      $("#rounds-clue").value="";
      $("#rounds-solution").value="";
      targetCircle=null;
      const targetImg=$("#rounds-target-image");
      if(targetImg){targetImg.onload=null;targetImg.removeAttribute("src");targetImg.hidden=true;}
      const oldPointImage=$("#rounds-point-image"); if(oldPointImage){oldPointImage.onload=null;oldPointImage.removeAttribute("src");oldPointImage.hidden=true;}
      const oldRoundImage=$("#rounds-image"); if(oldRoundImage){oldRoundImage.onerror=null;oldRoundImage.removeAttribute("src");oldRoundImage.hidden=true;}
      const targetCanvas=$("#rounds-target-canvas");
      if(targetCanvas){targetCanvas.width=1;targetCanvas.height=1;targetCanvas.style.width="1px";targetCanvas.style.height="1px";}
      $("#rounds-target-status").textContent="Wähle ein neues Bild und markiere den Zielkreis.";
      $("#rounds-upload-message").textContent="Wähle ein Bild für die neue Runde aus.";
      $("#rounds-mode-select").value="see";
      updateModeSetup();
    }
    $("#rounds-title").textContent=status==="finished"?"Runde beendet":(revealed?"Antworten aufgedeckt":"Runde läuft");
    const canPrepare = status === "active"
      ? false
      : (status === "finished" ? Boolean(isNextHost) : Boolean(isHost));
    $("#rounds-setup").hidden = !canPrepare;
    $("#rounds-play").hidden=(status!=="active"&&status!=="finished") || (status==="finished"&&Boolean(isNextHost));
    $("#rounds-clue-display").textContent=round.clue||"";
    const image=$("#rounds-image");
    // Im Punktmodus wird nur das interaktive Bild gerendert, nicht zusätzlich das normale Bild.
    if(round.image_url && !pointMode){image.src=round.image_url;image.hidden=false;image.onerror=()=>{image.hidden=true;};}
    else{image.removeAttribute("src");image.hidden=true;}
    $("#rounds-point-play").hidden=!pointMode;
    if(pointMode){
      const pointImg=$("#rounds-point-image");
      if(round.image_url&&pointImg.src!==round.image_url){pointImg.onload=()=>drawPlayerPoint(round);pointImg.src=round.image_url;pointImg.hidden=false;}
      else if(round.image_url){pointImg.hidden=false;drawPlayerPoint(round);}
      const pointWrap = $("#rounds-point-wrap");
      pointWrap.classList.toggle("point-player", !Boolean(round.is_host));
      pointWrap.classList.toggle("point-host", Boolean(round.is_host));
      pointSubmitted=Boolean(round.my_point_submitted);
      $("#rounds-point-status").textContent=round.is_host?"Du leitest diese Runde. Die Tipps der Mitspieler werden nach und nach erfasst.":(pointSubmitted?"Tipp abgegeben! Warte auf die anderen Mitspieler.":"Tippe einmal auf die vermutete Stelle im Bild.");
      drawPlayerPoint(round);
    }
    $("#rounds-answer-entry").hidden=pointMode||Boolean(round.is_host)||status!=="active"||Boolean(round.my_answer_submitted);
    $("#rounds-finish").hidden=!Boolean(round.is_host)||status!=="active"||!allAnswered;
    const revealStatus=$("#rounds-reveal-status");
    revealStatus.hidden=canSeeAnswers||pointMode;
    revealStatus.textContent=canSeeAnswers?"":"Die Antworten bleiben geheim, bis alle Mitspieler geantwortet haben.";
    $("#rounds-solution-display").textContent=round.secret_answer?`Richtige Lösung: ${round.secret_answer}`:(status==="finished"?"Die Runde ist beendet.":"");
    const list=$("#rounds-answers");list.replaceChildren();
    if(pointMode){
      if(canSeeAnswers){
        (round.point_answers||[]).forEach(p=>{
          const row=document.createElement("div");row.className="rounds-answer";
          const info=document.createElement("span"),name=document.createElement("b"),value=document.createElement("small");
          name.textContent=p.player_name;value.textContent=p.is_correct?"Treffer – 1 Punkt ✓":"Daneben – 0 Punkte ✕";info.append(name,value);row.appendChild(info);list.appendChild(row);
        });
      }
      return;
    }
    if(!canSeeAnswers)return;
    (round.answers||[]).forEach(answer=>{
      const row=document.createElement("div");row.className="rounds-answer";
      const info=document.createElement("span"),name=document.createElement("b"),value=document.createElement("small");
      name.textContent=answer.player_name;
      value.textContent=`${answer.answer} · ${answer.is_correct?"Richtig ✓":answer.reviewed?"Falsch ✕":"Noch nicht bewertet"}`;
      info.append(name,value);
      if(Array.isArray(answer.reactions)&&answer.reactions.length){
        const counts=answer.reactions.reduce((acc,item)=>{acc[item.emoji]=(acc[item.emoji]||0)+1;return acc;},{});
        const summary=document.createElement("small");summary.textContent=Object.entries(counts).map(([emoji,count])=>`${emoji} ${count}`).join(" · ");info.appendChild(summary);
      }
      row.appendChild(info);
      if(revealed&&!Boolean(round.is_host)&&status==="active"){
        const reactions=document.createElement("div");reactions.className="rounds-reactions";
        ["😂","👍","👎","❤️","🤔"].forEach(emoji=>{
          const button=document.createElement("button");button.type="button";button.className="rounds-reaction";button.textContent=emoji;button.title=`Mit ${emoji} reagieren`;
          if(answer.my_reaction===emoji)button.classList.add("selected");
          button.addEventListener("click",async()=>{
            reactions.querySelectorAll("button").forEach(b=>b.disabled=true);
            try{await rpc("set_game_answer_reaction",{p_code:roomCode,p_player_name:playerName,p_answer_player_name:answer.player_name,p_reaction:emoji});await refreshRound();}
            catch(e){message(e.message,true);reactions.querySelectorAll("button").forEach(b=>b.disabled=false);}
          });
          reactions.appendChild(button);
        });
        row.appendChild(reactions);
      }
      if(Boolean(round.is_host)&&allAnswered&&!answer.reviewed&&answer.answer&&status==="active"){
        const actions=document.createElement("div");actions.className="rounds-reactions";
        const correct=document.createElement("button");correct.className="rounds-btn secondary";correct.textContent="✓ Richtig";
        correct.addEventListener("click",async()=>{try{await rpc("mark_game_answer_correct",{p_code:roomCode,p_host_name:playerName,p_answer_player_name:answer.player_name});await refreshRound();}catch(e){message(e.message,true);}});
        const wrong=document.createElement("button");wrong.className="rounds-btn secondary";wrong.textContent="✕ Falsch";
        wrong.addEventListener("click",async()=>{try{await rpc("mark_game_answer_wrong",{p_code:roomCode,p_host_name:playerName,p_answer_player_name:answer.player_name});await refreshRound();}catch(e){message(e.message,true);}});
        actions.append(correct,wrong);row.appendChild(actions);
      }
      list.appendChild(row);
    });
  }
  async function startRound() {
    const mode=selectedMode(), clue=$("#rounds-clue").value.trim(), solution=$("#rounds-solution").value.trim();
    const imageUrl=$("#rounds-image-url").value.trim()||null;
    if(!imageUrl && mode==="point") return message("Für „Finde den Punkt“ musst du zuerst ein Bild hochladen oder eine Bild-URL eintragen.",true);
    if(mode==="point"&&!targetCircle) return message("Bitte zeichne zuerst den Zielkreis auf dem Bild ein.",true);
    if(mode==="see"&&(!clue||!solution)) return message("Bitte Hinweis und richtige Lösung ausfüllen.",true);
    const button=$("#rounds-start");button.disabled=true;
    try{
      await rpc("start_game_round",{
        p_code:roomCode,p_player_name:playerName,p_mode:mode,p_clue:clue||"Finde die markierte Stelle",
        p_secret_answer:solution||"Zielkreis",p_image_url:imageUrl,
        p_rotate_leader:Boolean($("#rounds-rotate-leader").checked),
        p_target_x:mode==="point"?targetCircle.x:null,
        p_target_y:mode==="point"?targetCircle.y:null,
        p_target_radius:mode==="point"?targetCircle.r:null,
        p_target_aspect:mode==="point"?($("#rounds-target-image").naturalWidth/$("#rounds-target-image").naturalHeight):null
      });
      clearedFinishedRoundKey="";
      message("Die Runde läuft. Die Mitspieler können jetzt spielen.");await refreshRound();
    }catch(e){message("Runde konnte nicht gestartet werden: "+e.message,true);}
    finally{button.disabled=false;}
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
