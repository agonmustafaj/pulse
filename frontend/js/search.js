import { apiGet } from "./api.js";
import { $, refreshIcons } from "./ui.js";
import { navigate } from "./router.js";

let open = false;
let active = 0;
let results = [];
let recent = JSON.parse(localStorage.getItem("pulse-recent-search") || "[]");

export function initSearch() {
  const overlay = $("#search-overlay");
  const input = $("#search-input");
  const list = $("#search-results");

  $("#btn-search").addEventListener("click", () => toggle(true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) toggle(false);
  });
  $("#drawer-close")?.addEventListener("click", () => {
    /* drawer handled in app */
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggle(!open);
    }
    if (!open) return;
    if (e.key === "Escape") toggle(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = Math.min(active + 1, results.length - 1);
      paint();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      paint();
    }
    if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      openResult(results[active]);
    }
  });

  let t;
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => query(input.value), 200);
  });

  function paint() {
    if (!results.length) {
      list.innerHTML = `
        <div class="empty">
          ${input.value ? "No results" : "Try APOD, Mars, ISS, launch…"}
          ${
            recent.length
              ? `<div style="margin-top:12px" class="chip-row">${recent
                  .map((r) => `<button class="chip" data-recent="${r}">${r}</button>`)
                  .join("")}</div>`
              : ""
          }
        </div>`;
      list.querySelectorAll("[data-recent]").forEach((b) => {
        b.onclick = () => {
          input.value = b.dataset.recent;
          query(input.value);
        };
      });
      return;
    }
    list.innerHTML = results
      .map(
        (r, i) => `
      <div class="search-result${i === active ? " active" : ""}" data-idx="${i}">
        <div>
          <div class="item-title">${r.title}</div>
          <div class="item-meta"><span class="badge">${r.category}</span><span>${r.subtitle || ""}</span></div>
        </div>
        <div class="mono muted">${r.route}</div>
      </div>`
      )
      .join("");
    list.querySelectorAll(".search-result").forEach((node) => {
      node.onclick = () => openResult(results[Number(node.dataset.idx)]);
    });
  }

  async function query(q) {
    active = 0;
    if (!q || q.length < 2) {
      results = [];
      paint();
      return;
    }
    try {
      const data = await apiGet("/api/search", { q });
      results = data.items || [];
    } catch {
      results = [];
    }
    paint();
  }

  function openResult(r) {
    recent = [r.title, ...recent.filter((x) => x !== r.title)].slice(0, 6);
    localStorage.setItem("pulse-recent-search", JSON.stringify(recent));
    toggle(false);
    navigate(r.route);
  }

  function toggle(next) {
    open = next;
    overlay.classList.toggle("open", open);
    if (open) {
      input.value = "";
      results = [];
      paint();
      setTimeout(() => input.focus(), 0);
      refreshIcons();
    }
  }
}
