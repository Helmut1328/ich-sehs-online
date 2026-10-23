(() => {
  const $ = (selector) => document.querySelector(selector);
  const nameInput = $("#player-name");
  const codeInput = $("#room-code");
  const message = $("#message");
  const roomPanel = $("#room-panel");

  let selectedMode = "see";
  let activeRoomCode = null;
  window.roomGameMode = null;

  function applyRoomMode(mode) {
    if (!["see", "detail"].includes(mode)) return;
    window.roomGameMode = mode;
    selectedMode = mode;
    document.querySelectorAll(".mode-card").forEach((item) => {
      item.classList.toggle("selected", item.dataset.mode === mode);
      item.disabled = Boolean(activeRoomCode);
      item.setAttribute("aria-disabled", String(Boolean(activeRoomCode)));
    });
  }
  let refreshTimer = null;

  // Anonyme, dauerhafte Kennung dieses Browsers für wiederholten Beitritt.
  const CLIENT_TOKEN_KEY = "ich-sehs-client-token-v1";

  function getClientToken() {
    let token = "";
    try {
      token = window.localStorage.getItem(CLIENT_TOKEN_KEY) || "";
      if (!/^[a-f0-9-]{36}$/i.test(token)) {
        if (!window.crypto || typeof window.crypto.randomUUID !== "function") {
          throw new Error("Dieser Browser unterstützt keine sichere Kennungserstellung.");
        }
        token = window.crypto.randomUUID();
        window.localStorage.setItem(CLIENT_TOKEN_KEY, token);
      }
    } catch (error) {
      throw new Error("Die anonyme Spielerkennung konnte nicht gespeichert werden. Bitte normalen Browsermodus verwenden.");
    }
    return token;
  }

  const config = window.GAME_CONFIG || {};
  const supabaseUrl = (config.SUPABASE_URL || "").replace(/\/+$/, "");
  const publicKey = config.SUPABASE_PUBLISHABLE_KEY || "";

  function setMessage(text, kind = "") {
    message.textContent = text;
    message.className = `message ${kind}`.trim();
  }

  function getPlayerName() {
    return nameInput.value.trim().slice(0, 20);
  }

  function checkConfig() {
    if (!supabaseUrl || !publicKey || publicKey.includes("HIER_DEINEN")) {
      throw new Error("Die Supabase-Konfiguration fehlt noch. Bitte prüfe config.js und trage dort den öffentlichen Publishable-/anon-Key ein.");
    }
  }

  async function rpc(functionName, parameters) {
    checkConfig();
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`
      },
      body: JSON.stringify(parameters)
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      const detail = data && typeof data === "object"
        ? (data.message || data.details || data.hint || JSON.stringify(data))
        : String(data || `HTTP ${response.status}`);
      throw new Error(detail);
    }
    return data;
  }

  function stopRefresh() {
    if (refreshTimer !== null) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function showRoomPanel(roomCode, playerName, status = "waiting") {
    activeRoomCode = roomCode;
    $("#shown-code").textContent = roomCode;
    $("#shown-player").textContent = playerName;
    $("#room-title").textContent = status === "waiting" ? "Warte auf Mitspieler" : "Spielraum";
    const badge = roomPanel.querySelector(".room-badge");
    if (badge) badge.textContent = "Online";
    const explainer = roomPanel.querySelector(".room-explainer");
    if (explainer) explainer.textContent = "Du bist mit Supabase verbunden. Teile den Raumcode mit deinen Mitspielern.";
    roomPanel.classList.remove("hidden");
    roomPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    refreshRoom();
    stopRefresh();
    refreshTimer = window.setInterval(refreshRoom, 5000);
  }

  function renderPlayers(players) {
    // Alte Liste vollständig entfernen, damit Refreshes keine doppelten Überschriften erzeugen.
    roomPanel.querySelectorAll("#room-player-list").forEach((list) => list.remove());
    roomPanel.querySelectorAll(".room-player").forEach((row) => row.remove());

    const roomActions = roomPanel.querySelector(".room-actions");
    const list = document.createElement("div");
    list.id = "room-player-list";

    const heading = document.createElement("p");
    heading.className = "field-label";
    heading.textContent = `Mitspieler (${players.length})`;
    list.appendChild(heading);

    players.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "room-player";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "10px";

      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.textContent = index === 0 ? "👑" : "🙂";

      const details = document.createElement("span");
      details.style.flex = "1";

      const name = document.createElement("b");
      name.textContent = player.name || "Spieler";

      const subtitle = document.createElement("small");
      subtitle.textContent = index === 0 ? "Gastgeber" : `Spieler ${player.player_order || index + 1}`;
      details.append(name, subtitle);

      const score = document.createElement("span");
      score.className = "player-score";
      score.style.fontWeight = "800";
      score.style.whiteSpace = "nowrap";
      const points = Number(player.score || 0);
      score.textContent = `⭐ ${points} ${points === 1 ? "Punkt" : "Punkte"}`;

      row.append(avatar, details, score);

      if (index === 0) {
        const tag = document.createElement("span");
        tag.className = "you-tag";
        tag.textContent = "HOST";
        row.appendChild(tag);
      }
      list.appendChild(row);
    });

    if (roomActions) roomPanel.insertBefore(list, roomActions);
    else roomPanel.appendChild(list);
  }

  async function refreshRoom() {
    if (!activeRoomCode) return;
    try {
      const room = await rpc("get_game_room", { p_code: activeRoomCode });
      if (room && Array.isArray(room.players)) {
        renderPlayers(room.players);
        $("#room-title").textContent = room.status === "waiting" ? "Warte auf Mitspieler" : "Spielraum";
        const modeInfo = await rpc("get_game_room_mode", { p_code: activeRoomCode });
        if (modeInfo && modeInfo.game_mode) applyRoomMode(modeInfo.game_mode);
      }
    } catch (error) {
      console.warn("Raumstatus konnte nicht aktualisiert werden:", error);
    }
  }

  document.querySelectorAll(".mode-card").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode-card").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      if (activeRoomCode) {
        setMessage("Der Spielmodus ist für diesen Raum festgelegt und kann hier nicht geändert werden.");
        return;
      }
      selectedMode = button.dataset.mode;
      window.roomGameMode = null;
      setMessage(`Modus gewählt: ${selectedMode === "see" ? "Ich sehe was …" : "Finde das Detail"}.`);
    });
  });

  $("#create-room").addEventListener("click", async () => {
    const name = getPlayerName();
    if (!name) {
      setMessage("Bitte gib zuerst deinen Spielernamen ein.", "error");
      nameInput.focus();
      return;
    }
    const button = $("#create-room");
    button.disabled = true;
    button.textContent = "Raum wird erstellt …";
    setMessage("Verbinde mit Supabase …");
    try {
      const room = await rpc("create_game_room", { p_name: name });
      if (!room || !room.room_code) throw new Error("Supabase hat keinen Raumcode zurückgegeben.");
      await rpc("set_game_room_mode", {
        p_code: room.room_code,
        p_player_name: name,
        p_mode: selectedMode
      });
      applyRoomMode(selectedMode);
      codeInput.value = room.room_code;
      showRoomPanel(room.room_code, name, room.status);
      setMessage(`Dein Online-Raum ${room.room_code} wurde erstellt. Teile den Code mit deinen Mitspielern.`, "success");
    } catch (error) {
      console.error(error);
      setMessage(`Raum konnte nicht erstellt werden: ${error.message}`, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = "<span>＋</span> Neuen Raum erstellen";
    }
  });

  $("#join-room").addEventListener("click", async () => {
    const name = getPlayerName();
    const code = codeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!name) {
      setMessage("Bitte gib zuerst deinen Spielernamen ein.", "error");
      nameInput.focus();
      return;
    }
    if (code.length < 4) {
      setMessage("Bitte gib einen gültigen Raumcode mit mindestens 4 Zeichen ein.", "error");
      codeInput.focus();
      return;
    }

    const button = $("#join-room");
    button.disabled = true;
    button.textContent = "…";
    setMessage("Raum wird gesucht …");
    try {
      const room = await rpc("join_game_room", {
        p_code: code,
        p_name: name,
        p_client_token: getClientToken()
      });
      if (!room || !room.room_code) throw new Error("Supabase hat keine Raumdaten zurückgegeben.");
      const modeInfo = await rpc("get_game_room_mode", { p_code: room.room_code });
      applyRoomMode(modeInfo.game_mode || "see");
      showRoomPanel(room.room_code, room.player_name || name, room.status);
      setMessage(
        room.already_joined
          ? `Du bist bereits in Raum ${room.room_code}. Es wurde kein weiterer Spielereintrag angelegt.`
          : `Du bist Raum ${room.room_code} beigetreten.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setMessage(`Beitritt nicht möglich: ${error.message}`, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Beitreten";
    }
  });

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  });

  $("#copy-code").addEventListener("click", async () => {
    const code = $("#shown-code").textContent;
    try {
      await navigator.clipboard.writeText(code);
      $("#copy-code").textContent = "Kopiert ✓";
    } catch {
      setMessage(`Raumcode: ${code} (bitte manuell kopieren)`);
    }
  });

  $("#back-home").addEventListener("click", () => {
    stopRefresh();
    activeRoomCode = null;
    window.roomGameMode = null;
    document.querySelectorAll(".mode-card").forEach((item) => { item.disabled = false; item.removeAttribute("aria-disabled"); });
    roomPanel.classList.add("hidden");
    const list = $("#room-player-list");
    if (list) list.remove();
    setMessage("Wähle einen Modus und gib deinen Namen ein.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Zählt einen Seitenaufruf. Der geheime Schlüssel wird nie im Browser verwendet.
  if (config.TRACKING_FUNCTION_URL) {
    fetch(config.TRACKING_FUNCTION_URL, { method: "POST", mode: "cors" })
      .then((response) => {
        if (!response.ok) throw new Error(`Tracking HTTP ${response.status}`);
      })
      .catch((error) => console.warn("Aufruf konnte nicht gezählt werden:", error));
  }

  console.info(`Ich seh's! bereit. Gewählter Modus: ${selectedMode}`);
})();
