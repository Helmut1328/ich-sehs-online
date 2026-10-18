(() => {
  const $ = (selector) => document.querySelector(selector);
  const nameInput = $("#player-name");
  const codeInput = $("#room-code");
  const message = $("#message");
  const roomPanel = $("#room-panel");
  let selectedMode = "see";

  const setMessage = (text, kind = "") => {
    message.textContent = text;
    message.className = `message ${kind}`.trim();
  };

  document.querySelectorAll(".mode-card").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".mode-card").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      selectedMode = button.dataset.mode;
      setMessage(`Modus gewählt: ${selectedMode === "see" ? "Ich sehe was …" : "Finde das Detail"}.`);
    });
  });

  const playerName = () => nameInput.value.trim().slice(0, 20);

  function showPreviewRoom(code) {
    const name = playerName();
    if (!name) {
      setMessage("Bitte gib zuerst deinen Spielernamen ein.", "error");
      nameInput.focus();
      return;
    }
    $("#shown-code").textContent = code;
    $("#shown-player").textContent = name;
    $("#room-title").textContent = "Dein Raum ist vorbereitet";
    roomPanel.classList.remove("hidden");
    roomPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    setMessage("Das ist aktuell eine Vorschau. Online-Räume und Beitritt werden im nächsten Schritt mit Supabase aktiviert.", "success");
  }

  $("#create-room").addEventListener("click", () => {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    showPreviewRoom(code);
  });

  $("#join-room").addEventListener("click", () => {
    const code = codeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) {
      setMessage("Bitte gib einen gültigen Raumcode mit mindestens 4 Zeichen ein.", "error");
      codeInput.focus();
      return;
    }
    showPreviewRoom(code);
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
    roomPanel.classList.add("hidden");
    setMessage("Wähle einen Modus und gib deinen Namen ein.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Zählt einen echten Seitenaufruf über die Edge Function.
  // Der geheime Supabase-Schlüssel wird dafür nicht im Browser benötigt.
  const config = window.GAME_CONFIG || {};
  if (config.TRACKING_FUNCTION_URL) {
    fetch(config.TRACKING_FUNCTION_URL, { method: "POST", mode: "cors" })
      .then((response) => {
        if (!response.ok) throw new Error(`Tracking HTTP ${response.status}`);
      })
      .catch((error) => console.warn("Aufruf konnte nicht gezählt werden:", error));
  }

  // Online-Verbindung wird bewusst erst nach Eintragen des öffentlichen Keys aktiviert.
  if (!config.SUPABASE_PUBLISHABLE_KEY ||
      config.SUPABASE_PUBLISHABLE_KEY.includes("HIER_DEINEN")) {
    console.info("Supabase-Frontend-Key fehlt noch. Die Raumoberfläche läuft vorerst im Vorschau-Modus.");
  }
})();
