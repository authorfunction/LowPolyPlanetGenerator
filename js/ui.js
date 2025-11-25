// Map DOM IDs to variables
export const ui = {
  presetSelect: document.getElementById("preset-select"),
  btnSave: document.getElementById("btn-save"),
  btnSaveAs: document.getElementById("btn-save-as"),
  btnDelete: document.getElementById("btn-delete"),
  // Modal Elements
  cloudCoverage: document.getElementById("cloudCoverage"),
  cloudSize: document.getElementById("cloudSize"),
  cloudAltitude: document.getElementById("cloudAltitude"),

  // Cloud Controls
  cShrink: document.getElementById("c-shrink"),
  cTrans: document.getElementById("c-trans"),
  rDark: document.getElementById("r-dark"),

  starDensity: document.getElementById("starDensity"),
  modalOverlay: document.getElementById("modal-overlay"),
  modalTitle: document.getElementById("modal-title"),
  modalText: document.getElementById("modal-text"),
  modalInput: document.getElementById("modal-input"),
  modalConfirm: document.getElementById("modal-confirm"),
  modalCancel: document.getElementById("modal-cancel"),
  // Camera Controls
  camReset: document.getElementById("cam-reset"),
  camFront: document.getElementById("cam-front"),
  camTop: document.getElementById("cam-top"),
  // Inputs
  seed: document.getElementById("seed"),
  detail: document.getElementById("detail"),
  scale: document.getElementById("scale"),
  height: document.getElementById("height"),
  water: document.getElementById("water"),
  veg: document.getElementById("veg"),
  atmo: document.getElementById("atmo"),
  alayers: document.getElementById("alayers"),
  speed: document.getElementById("speed"),
  cspeed: document.getElementById("cspeed"),
  sun: document.getElementById("sun"),
  dark: document.getElementById("dark"),
  halo: document.getElementById("halo"),
  sred: document.getElementById("sred"),
  sbright: document.getElementById("sbright"),
  soff: document.getElementById("soff"),
  swidth: document.getElementById("swidth"),
  ascale: document.getElementById("ascale"),
  hspread: document.getElementById("hspread"),
  hint: document.getElementById("hint"),
  hfall: document.getElementById("hfall"),
  stars: document.getElementById("stars"),
  cCov: document.getElementById("c-cov"),
  cAlt: document.getElementById("c-alt"),
  cSize: document.getElementById("c-size"),
  random: document.getElementById("randomize-btn"),
  presets: document.querySelectorAll(".preset-btn"),
  toggle: document.getElementById("ui-toggle"),
  panel: document.getElementById("ui-panel"),
  pauseIndicator: document.getElementById("pause-indicator"),
  htoggle: document.getElementById("hazetoggle"),
  // New UI
  hStr: document.getElementById("h-str"),
  hPow: document.getElementById("h-pow"),
  chaze: document.getElementById("chaze"),
  cwrap: document.getElementById("cwrap"), // <--- Add this
  wSpeed: document.getElementById("wspeed"),
  wHeight: document.getElementById("wheight"),
  // Solar Effects
  sunDist: document.getElementById("sun-dist"),
  atmoDist: document.getElementById("atmo-dist"),
  //hazeDist: document.getElementById("haze-dist"), <== INCORRECT
  vib: document.getElementById("vib"),
  flip: document.getElementById("flip-cycle"),
  solar: document.getElementById("solar-enabled"),
  sunrise: document.getElementById("sunrise-temp"),
  sunset: document.getElementById("sunset-temp"),
  riseTint: document.getElementById("risetint"),
  setTint: document.getElementById("settint"),
  tintDim: document.getElementById("tint-dim"),
};

export const displays = {
  seed: document.getElementById("val-seed"),
  detail: document.getElementById("val-detail"),
  scale: document.getElementById("val-scale"),
  height: document.getElementById("val-height"),
  water: document.getElementById("val-water"),
  veg: document.getElementById("val-veg"),
  atmo: document.getElementById("val-atmo"),
  alayers: document.getElementById("val-alayers"),
  speed: document.getElementById("val-speed"),
  cspeed: document.getElementById("val-cspeed"),
  sun: document.getElementById("val-sun"),
  dark: document.getElementById("val-dark"),
  halo: document.getElementById("val-halo"),
  sred: document.getElementById("val-sred"),
  sbright: document.getElementById("val-sbright"),
  soff: document.getElementById("val-soff"),
  swidth: document.getElementById("val-swidth"),
  ascale: document.getElementById("val-ascale"),
  hspread: document.getElementById("val-hspread"),
  hint: document.getElementById("val-hint"),
  hfall: document.getElementById("val-hfall"),
  stars: document.getElementById("val-stars"),
  cCov: document.getElementById("val-c-cov"),
  cAlt: document.getElementById("val-c-alt"),
  cSize: document.getElementById("val-c-size"),
  cShrink: document.getElementById("val-c-shrink"), // <--- ADDED
  cTrans: document.getElementById("val-c-trans"),   // <--- ADDED
  rDark: document.getElementById("val-r-dark"),     // <--- ADDED
  // New Display
  hStr: document.getElementById("val-h-str"),
  hPow: document.getElementById("val-h-pow"),
  chaze: document.getElementById("val-chaze"),
  cwrap: document.getElementById("val-cwrap"), // <--- Add this
  wSpeed: document.getElementById("val-wspeed"),
  wHeight: document.getElementById("val-wheight"),
  sunDist: document.getElementById("val-sun-dist"),
  atmoDist: document.getElementById("val-atmo-dist"),
  //hazeDist: document.getElementById("val-haze-dist"), // <== INCORRECT
  vib: document.getElementById("val-vib"),
  riseTint: document.getElementById("val-risetint"),
  setTint: document.getElementById("val-settint"),
  tintDim: document.getElementById("val-tint-dim"),
};

// Modal Logic
export function showModal(title, text, isPrompt = false, isConfirm = false) {
  return new Promise((resolve) => {
    ui.modalTitle.innerText = title;
    ui.modalText.innerText = text;
    ui.modalOverlay.classList.add("active");

    // Setup Input
    if (isPrompt) {
      ui.modalInput.classList.remove("hidden");
      ui.modalInput.value = "";
      ui.modalInput.focus();
    } else {
      ui.modalInput.classList.add("hidden");
    }

    // Setup Buttons
    if (isConfirm || isPrompt) {
      ui.modalCancel.classList.remove("hidden");
    } else {
      ui.modalCancel.classList.add("hidden");
    }

    // Handlers
    const close = () => {
      ui.modalOverlay.classList.remove("active");
      cleanup();
    };

    const onConfirm = () => {
      const val = isPrompt ? ui.modalInput.value : true;
      close();
      resolve(val);
    };

    const onCancel = () => {
      close();
      resolve(false);
    };

    const onKey = (e) => {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") onCancel();
    };

    ui.modalConfirm.onclick = onConfirm;
    ui.modalCancel.onclick = onCancel;
    ui.modalInput.onkeydown = onKey;

    function cleanup() {
      ui.modalConfirm.onclick = null;
      ui.modalCancel.onclick = null;
      ui.modalInput.onkeydown = null;
    }
  });
}
