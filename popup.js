const DEFAULTS = { keepComments: false, keepAnnotations: [], preserveBlanks: false };

const commentsEl = document.getElementById("keepComments");
const blanksEl = document.getElementById("preserveBlanks");
const annosEl = document.getElementById("keepAnnotations");
const statusEl = document.getElementById("status");

let statusTimer = null;
function flash(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(function () {
    statusEl.textContent = "";
  }, 1200);
}

function load() {
  chrome.storage.sync.get(DEFAULTS, function (s) {
    commentsEl.checked = !!s.keepComments;
    blanksEl.checked = !!s.preserveBlanks;
    const list = Array.isArray(s.keepAnnotations) ? s.keepAnnotations : [];
    annosEl.value = list.join("\n");
  });
}

function save() {
  const list = annosEl.value
    .split(/[\n,]/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  chrome.storage.sync.set(
    {
      keepComments: commentsEl.checked,
      preserveBlanks: blanksEl.checked,
      keepAnnotations: list,
    },
    function () {
      flash("Saved");
    }
  );
}

let saveTimer = null;
commentsEl.addEventListener("change", save);
blanksEl.addEventListener("change", save);
annosEl.addEventListener("input", function () {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
});

load();
