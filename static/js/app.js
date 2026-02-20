/* =========================
   Collab Artists Renderer
========================= */
const COLLAB_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=0&single=true&output=csv";

const COLLAB_MOUNT_SELECTOR = "#collabGrid";

/* ---------- text helpers ---------- */
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function nl2br(str = "") {
  return escapeHtml(str).replace(/\n/g, "<br>");
}

/* ---------- active normalize ---------- */
function isActive(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "O" || s === "TRUE" || s === "Y" || s === "1";
}

/* ---------- Google Drive lh3 direct ---------- */
function extractDriveFileId(url) {
  if (!url) return "";
  const s = String(url).trim();

  let m = s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m?.[1]) return m[1];

  m = s.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m?.[1]) return m[1];

  m = s.match(/drive\.google\.com\/uc\?(?:export=[^&]+&)?id=([^&]+)/i);
  if (m?.[1]) return m[1];

  m = s.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/i);
  if (m?.[1]) return m[1];

  return "";
}

function toGoogleusercontent(url, { size = "w1200" } = {}) {
  if (!url) return "";
  const s = String(url).trim();

  if (/^https?:\/\/lh3\.googleusercontent\.com\//i.test(s)) return s;
  if (/^https?:\/\/drive\.google\.com\/thumbnail\?/i.test(s)) return s;

  const id = extractDriveFileId(s);
  if (!id) return s;

  return `https://drive.google.com/thumbnail?id=${id}&sz=${encodeURIComponent(size)}`;
}

/* ---------- CSV parser ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }

    if (ch === "\r") continue;

    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every((c) => String(c).trim() === "")) {
    rows.pop();
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows?.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => String(c).trim() === "")) continue;

    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? "";
    out.push(obj);
  }
  return out;
}

/* ---------- render ---------- */
function renderCollabs(items, mountEl) {
  const visible = items.filter((it) => isActive(it.active));

  if (!visible.length) {
    mountEl.innerHTML = `<p class="collabEmpty">표시할 협업 작가가 없어요.</p>`;
    return;
  }

  const html = visible
    .map((it) => {
        const title = String(it.title ?? "").trim();
        const note = String(it.note ?? "").trim();
        const link = String(it.link ?? "").trim();
        const rawThumb = String(it.thumb ?? "").trim();
        const thumb = toGoogleusercontent(rawThumb);

        const safeTitle = escapeHtml(title);
        const safeNote = nl2br(note);
        const safeLink = escapeHtml(link);

        const hasThumb = !!thumb;
        const thumbInner = `
        <div class="collabCard__thumb">
            ${
            hasThumb
                ? `<img class="collabCard__img" src="${escapeHtml(thumb)}" alt="${safeTitle} 썸네일" loading="eager" />`
                : `<div class="collabCard__img collabCard__img--empty" aria-hidden="true">
                    <span class="collabCard__imgEmptyText">Thumbnail<br/>5:3</span>
                </div>`
            }
            <div class="collabCard__overlay">
            <span class="collabCard__cta">${link ? "페이지 보러가기" : "준비중"}</span>
            </div>
        </div>
        `;

      if (link) {
        return `
          <a class="collabCard collabCard--link"
             href="${safeLink}"
             target="_blank" rel="noopener"
             aria-label="${safeTitle} 작가 페이지로 이동">
            <div class="collabCard__thumb">${thumbInner}</div>
            <div class="collabCard__body">
              <h3 class="collabCard__title">${safeTitle}</h3>
              ${note ? `<p class="collabCard__note">${safeNote}</p>` : ""}
            </div>
          </a>
        `.trim();
      }

      return `
        <article class="collabCard" aria-label="${safeTitle}">
          <div class="collabCard__thumb">${thumbInner}</div>
          <div class="collabCard__body">
            <h3 class="collabCard__title">${safeTitle}</h3>
            ${note ? `<p class="collabCard__note">${safeNote}</p>` : ""}
          </div>
        </article>
      `.trim();
    })
    .join("");

  mountEl.innerHTML = html;
}

/* ---------- inject minimal hover ---------- */
function ensureCollabCardStyles() {
  const id = "collab-card-link-styles";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  document.head.appendChild(style);
}

/* ---------- init ---------- */
async function initCollabSection() {
  const mountEl = document.querySelector(COLLAB_MOUNT_SELECTOR);
  if (!mountEl) {
    console.warn("[collab] mount element not found:", COLLAB_MOUNT_SELECTOR);
    return;
  }

  ensureCollabCardStyles();

  try {
    const res = await fetch(COLLAB_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    const items = rowsToObjects(rows);

    renderCollabs(items, mountEl);
  } catch (err) {
    console.error("[collab] init failed:", err);
    mountEl.innerHTML = `<p class="collabEmpty">데이터를 불러오지 못했어요.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initCollabSection);






/* ==========================================================
   Notice
========================================================== */
const NOTICE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=723262761&single=true&output=csv";

const NOTICE_MOUNT_SELECTOR = "#notice";

function toOrderNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 9999;
}

function groupBy(items, key) {
  const map = new Map();
  for (const it of items) {
    const k = String(it?.[key] ?? "").trim();
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

function openAccordion(panel, duration = 260) {
  panel.style.display = "block";
  const target = panel.scrollHeight;

  panel.style.overflow = "hidden";
  panel.style.height = "0px";
  panel.style.transition = `height ${duration}ms ease`;
  panel.offsetHeight;

  panel.style.height = `${target}px`;

  const onEnd = (e) => {
    if (e.propertyName !== "height") return;
    panel.style.height = "auto";
    panel.style.overflow = "";
    panel.style.transition = "";
    panel.removeEventListener("transitionend", onEnd);
  };
  panel.addEventListener("transitionend", onEnd);
}

function closeAccordion(panel, duration = 240) {
  const start = panel.scrollHeight;

  panel.style.overflow = "hidden";
  panel.style.height = `${start}px`;
  panel.style.transition = `height ${duration}ms ease`;
  panel.offsetHeight;

  panel.style.height = "0px";

  const onEnd = (e) => {
    if (e.propertyName !== "height") return;
    panel.style.display = "none";
    panel.style.height = "";
    panel.style.overflow = "";
    panel.style.transition = "";
    panel.removeEventListener("transitionend", onEnd);
  };
  panel.addEventListener("transitionend", onEnd);
}

function initAccordion(container, { singleOpen = true } = {}) {
  const items = Array.from(container.querySelectorAll(".accItem"));

  items.forEach((item) => {
    const btn = item.querySelector(".accBtn");
    const panel = item.querySelector(".accPanel");

    const isOpen = item.classList.contains("is-open");
    btn.setAttribute("aria-expanded", String(isOpen));
    panel.style.display = isOpen ? "block" : "none";
    panel.style.height = isOpen ? "auto" : "0px";

    btn.addEventListener("click", () => {
      const nowOpen = item.classList.contains("is-open");

      if (singleOpen && !nowOpen) {
        for (const other of items) {
          if (other === item) continue;
          if (other.classList.contains("is-open")) {
            other.classList.remove("is-open");
            const ob = other.querySelector(".accBtn");
            const op = other.querySelector(".accPanel");
            ob.setAttribute("aria-expanded", "false");
            closeAccordion(op);
          }
        }
      }

      if (nowOpen) {
        item.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        closeAccordion(panel);
      } else {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        openAccordion(panel);
      }
    });
  });
}

function renderNotice(items, mountEl) {
  const cleaned = (items || []).filter((it) => {
    const g = String(it.group ?? "").trim();
    const d = String(it.desc ?? "").trim();
    return g && d;
  });

  if (!cleaned.length) {
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">공지사항</h2>
          <p class="desc">표시할 공지사항이 없어요.</p>
        </div>
      </div>
    `.trim();
    return;
  }

  const map = groupBy(cleaned, "group");

  const accItemsHtml = [];
  let idx = 0;

  for (const [groupName, rows] of map.entries()) {
    rows.sort((a, b) => toOrderNum(a.order) - toOrderNum(b.order));

    const panelId = `noticePanel_${idx}`;
    const btnId = `noticeBtn_${idx}`;

    const liHtml = rows
      .map((r) => {
        const icon = String(r.icon ?? "").trim();
        const desc = String(r.desc ?? "").trim();
        return `
          <li class="noticeRow">
            ${icon ? `<span class="noticeRow__icon" aria-hidden="true">${escapeHtml(icon)}</span>` : ""}
            <p class="noticeRow__desc">${nl2br(desc)}</p>
          </li>
        `.trim();
      })
      .join("");

    const openClass = idx === 0 ? " is-open" : "";

    accItemsHtml.push(`
      <section class="accItem${openClass}">
        <button
          class="accBtn"
          id="${btnId}"
          type="button"
          aria-expanded="false"
          aria-controls="${panelId}"
        >
          <span class="accBtn__title">${escapeHtml(groupName)}</span>
          <span class="accBtn__meta">${rows.length}개</span>
          <span class="accBtn__chev" aria-hidden="true"></span>
        </button>

        <div
          class="accPanel"
          id="${panelId}"
          role="region"
          aria-labelledby="${btnId}"
        >
          <ul class="noticeRows">
            ${liHtml}
          </ul>
        </div>
      </section>
    `.trim());

    idx += 1;
  }

  mountEl.innerHTML = `
    <div class="secBox">
      <div class="head">
        <h2 class="title">공지사항</h2>
        <p class="desc">작업 전 꼭 확인해주세요!</p>
      </div>

      <div class="noticeAcc" data-acc="notice">
        ${accItemsHtml.join("")}
      </div>
    </div>
  `.trim();

  initAccordion(mountEl.querySelector(".noticeAcc"), { singleOpen: true });
}

async function initNoticeSection() {
  const mountEl = document.querySelector(NOTICE_MOUNT_SELECTOR);
  if (!mountEl) return;

  try {
    const res = await fetch(NOTICE_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    const items = rowsToObjects(rows);

    renderNotice(items, mountEl);
  } catch (err) {
    console.error("[notice] init failed:", err);
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">공지사항</h2>
          <p class="desc">데이터를 불러오지 못했어요.</p>
        </div>
      </div>
    `.trim();
  }
}

document.addEventListener("DOMContentLoaded", initNoticeSection);





/* =========================
   Rigging Details
========================= */
const DETAILS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=1614622733&single=true&output=csv";

const DETAILS_MOUNT_SELECTOR = "#details";

function toNum(v, fallback = 9999) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function pickField(obj, candidates) {
  for (const key of candidates) {
    if (key in obj) return obj[key];
    const found = Object.keys(obj).find(
      (k) => k.trim().toLowerCase() === String(key).trim().toLowerCase()
    );
    if (found) return obj[found];
  }
  return "";
}

function groupByKey(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
}

/** drive image URL */
function buildDriveImgCandidates(rawUrl) {
  const id = extractDriveFileId(rawUrl);
  if (!id) return [rawUrl].filter(Boolean);

  return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1200`,
    `https://lh3.googleusercontent.com/d/${id}`,
    `https://drive.usercontent.google.com/download?id=${id}&export=view&confirm=t`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];
}

function attachImgFallback(mountEl) {
  mountEl.querySelectorAll("img.detailCard__img").forEach((img) => {
    const candidates = (() => {
      try {
        return JSON.parse(img.dataset.srcs || "[]");
      } catch {
        return [];
      }
    })();

    if (!candidates.length) return;

    const current = img.getAttribute("src") || "";
    const unique = [current, ...candidates].filter((v, i, a) => v && a.indexOf(v) === i);

    img.dataset.srcs = JSON.stringify(unique);
    img.dataset.step = img.dataset.step || "0";

    img.addEventListener("error", () => {
      const step = Number(img.dataset.step || "0") + 1;
      img.dataset.step = String(step);

      const srcs = (() => {
        try {
          return JSON.parse(img.dataset.srcs || "[]");
        } catch {
          return [];
        }
      })();

      const next = srcs[step];
      if (next) img.src = next;
    });
  });
}

function renderRiggingDetails(items, mountEl) {
  const cleaned = (items || []).filter((it) => {
    const groupName = String(pickField(it, ["group"])).trim();
    const imgUrl = String(pickField(it, ["image URL", "image_url", "image", "url"])).trim();
    return groupName && imgUrl;
  });

  if (!cleaned.length) {
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">리깅 디테일</h2>
          <p class="desc">표시할 이미지가 없어요.</p>
        </div>
      </div>
    `.trim();
    return;
  }

  const normalized = cleaned.map((it) => {
    const groupOrder = toNum(pickField(it, ["group order", "group_order", "groupOrder"]), 9999);
    const groupName = String(pickField(it, ["group"])).trim();
    const order = toNum(pickField(it, ["order"]), 9999);
    const subtitle = String(pickField(it, ["subtitle", "subTitle"])).trim();
    const rawUrl = String(pickField(it, ["image URL", "image_url", "image", "url"])).trim();

    const candidates = buildDriveImgCandidates(rawUrl);

    return {
      groupOrder,
      groupName,
      order,
      subtitle,
      rawUrl,
      img: candidates[0],
      candidates,
    };
  });

  normalized.sort((a, b) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    return a.groupName.localeCompare(b.groupName, "ko");
  });

  const grouped = groupByKey(normalized, (it) => `${it.groupOrder}__${it.groupName}`);

  const sectionsHtml = [];
  for (const [key, rows] of grouped.entries()) {
    const [, ...nameParts] = key.split("__");
    const groupName = nameParts.join("__");

    rows.sort((a, b) => a.order - b.order);

    const cards = rows
      .map((r) => {
        const alt = r.subtitle ? `${r.groupName} - ${r.subtitle}` : r.groupName;
        const srcsJson = escapeHtml(JSON.stringify(r.candidates));

        return `
          <figure class="detailCard">
            <div class="detailCard__imgWrap">
              <img
                class="detailCard__img"
                src="${escapeHtml(r.img)}"
                data-srcs="${srcsJson}"
                data-step="0"
                alt="${escapeHtml(alt)}"
                loading="eager"
              />
            </div>
            ${r.subtitle ? `<figcaption class="detailCard__cap">${escapeHtml(r.subtitle)}</figcaption>` : ""}
          </figure>
        `.trim();
      })
      .join("");

    sectionsHtml.push(`
      <section class="detailGroup">
        <h3 class="detailGroup__title">${escapeHtml(groupName)}</h3>
        <div class="detailGrid">
          ${cards}
        </div>
      </section>
    `.trim());
  }

  mountEl.innerHTML = `
    <div class="secBox">
      <div class="head">
        <h2 class="title">리깅 디테일</h2>
        <p class="desc">카테고리별로 디테일 샘플을 확인할 수 있어요.</p>
      </div>
      <div class="detailGroups">
        ${sectionsHtml.join("")}
      </div>
    </div>
  `.trim();

  attachImgFallback(mountEl);
}

async function initDetailsSection() {
  const mountEl = document.querySelector(DETAILS_MOUNT_SELECTOR);
  if (!mountEl) {
    console.warn("[details] mount element not found:", DETAILS_MOUNT_SELECTOR);
    return;
  }

  try {
    const res = await fetch(DETAILS_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    const items = rowsToObjects(rows);

    renderRiggingDetails(items, mountEl);
  } catch (err) {
    console.error("[details] init failed:", err);
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">리깅 디테일</h2>
          <p class="desc">데이터를 불러오지 못했어요.</p>
        </div>
      </div>
    `.trim();
  }
}

document.addEventListener("DOMContentLoaded", initDetailsSection);






/* =========================
   Rigging Options
========================= */
const OPTIONS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=1760607814&single=true&output=csv";

const OPTIONS_MOUNT_SELECTOR = "#options";

function normalizeOptions(items) {
  const cleaned = (items || [])
    .map((it) => ({
      group: String(it.group ?? "").trim(),
      order: toNum(it.order, 9999),
      title: String(it.title ?? "").trim(),
      desc: String(it.desc ?? "").trim(),
    }))
    .filter((it) => it.group && it.title);

  const seen = new Set();
  const deduped = [];
  for (const it of cleaned) {
    const key = `${it.group}__${it.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  return deduped;
}

function groupMap(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.group)) map.set(it.group, []);
    map.get(it.group).push(it);
  }
  return map;
}

function renderOptions(items, mountEl) {
  const normalized = normalizeOptions(items);

  if (!normalized.length) {
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">리깅 옵션</h2>
          <p class="desc">표시할 옵션이 없어요.</p>
        </div>
      </div>
    `.trim();
    return;
  }

  // group 순서: "기본 제공" 먼저, 그 외는 뒤
  const map = groupMap(normalized);
  const groupNames = Array.from(map.keys()).sort((a, b) => {
    const aW = a === "기본 제공" ? 0 : 1;
    const bW = b === "기본 제공" ? 0 : 1;
    if (aW !== bW) return aW - bW;
    return a.localeCompare(b, "ko");
  });

  const groupsHtml = groupNames
    .map((gname) => {
      const rows = map.get(gname) || [];
      rows.sort((a, b) => a.order - b.order);

      const listHtml = rows
        .map((r) => {
          const title = escapeHtml(r.title);
          const hasDesc = !!r.desc;

          return `
            <li class="optItem">
              <div class="optItem__title">${title}</div>
              ${
                hasDesc
                  ? `<div class="optItem__desc">${nl2br(r.desc)}</div>`
                  : ``
              }
            </li>
          `.trim();
        })
        .join("");

      return `
        <section class="optGroup card card--soft">
          <h3 class="optGroup__title">${escapeHtml(gname)}</h3>
          <ul class="optList">
            ${listHtml}
          </ul>
        </section>
      `.trim();
    })
    .join("");

  mountEl.innerHTML = `
    <div class="secBox">
      <div class="head">
        <h2 class="title">리깅 옵션</h2>
        <p class="desc">현재 패키지 구분 없이 모든 작업 풀퀄리티로 작업하고 있습니다.</p>
      </div>

      <div class="optWrap grid grid-2">
        ${groupsHtml}
      </div>
    </div>
  `.trim();
}

async function initOptionsSection() {
  const mountEl = document.querySelector(OPTIONS_MOUNT_SELECTOR);
  if (!mountEl) {
    console.warn("[options] mount element not found:", OPTIONS_MOUNT_SELECTOR);
    return;
  }

  try {
    const res = await fetch(OPTIONS_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    const items = rowsToObjects(rows);

    renderOptions(items, mountEl);
  } catch (err) {
    console.error("[options] init failed:", err);
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">리깅 옵션</h2>
          <p class="desc">데이터를 불러오지 못했어요.</p>
        </div>
      </div>
    `.trim();
  }
}

document.addEventListener("DOMContentLoaded", initOptionsSection);






/* =========================
   Portfolio
========================= */
const PORTFOLIO_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=1262635118&single=true&output=csv";

const PORTFOLIO_MOUNT_SELECTOR = "#portfolio";

/* ---------- youtube helpers ---------- */
function extractYouTubeId(url) {
  if (!url) return "";
  const s = String(url).trim();

  let m = s.match(/youtu\.be\/([^?&/]+)/i);
  if (m?.[1]) return m[1];

  m = s.match(/[?&]v=([^?&/]+)/i);
  if (m?.[1]) return m[1];

  m = s.match(/youtube\.com\/shorts\/([^?&/]+)/i);
  if (m?.[1]) return m[1];

  m = s.match(/youtube\.com\/embed\/([^?&/]+)/i);
  if (m?.[1]) return m[1];

  return "";
}

function buildYouTubeThumbCandidates(videoId) {
  if (!videoId) return [];

  const jpg = `https://i.ytimg.com/vi/${videoId}`;
  const webp = `https://i.ytimg.com/vi_webp/${videoId}`;

  return [
    `${jpg}/maxresdefault.jpg`,
    `${webp}/maxresdefault.webp`,
    `${jpg}/sddefault.jpg`,
    `${webp}/sddefault.webp`,
    `${jpg}/hqdefault.jpg`,
    `${webp}/hqdefault.webp`,
    `${jpg}/mqdefault.jpg`,
    `${webp}/mqdefault.webp`,
    `${jpg}/default.jpg`,
    `${webp}/default.webp`,
  ];
}

function attachThumbFallback(containerEl) {
  containerEl.querySelectorAll("img.pfThumb__img").forEach((img) => {
    const candidates = (() => {
      try {
        return JSON.parse(img.dataset.srcs || "[]");
      } catch {
        return [];
      }
    })();
    if (!candidates.length) return;

    const current = img.getAttribute("src") || "";
    const unique = [current, ...candidates].filter((v, i, a) => v && a.indexOf(v) === i);

    img.dataset.srcs = JSON.stringify(unique);
    img.dataset.step = img.dataset.step || "0";

    img.addEventListener("error", () => {
      const step = Number(img.dataset.step || "0") + 1;
      img.dataset.step = String(step);

      const srcs = (() => {
        try {
          return JSON.parse(img.dataset.srcs || "[]");
        } catch {
          return [];
        }
      })();

      const next = srcs[step];
      if (next) img.src = next;
    });
  });
}

/* ---------- normalize / render ---------- */
function normalizePortfolio(items) {
  const cleaned = (items || [])
    .map((it) => ({
      order: toNum(it.order, 9999),
      title: String(it.title ?? "").trim(),
      desc: String(it.desc ?? "").trim(),
      url: String(it.URL ?? it.url ?? it.link ?? "").trim(),
      active: it.active,
    }))
    .filter((it) => isActive(it.active) && it.url);

  cleaned.sort((a, b) => a.order - b.order);
  return cleaned;
}

function renderPortfolio(items, mountEl) {
  const rows = normalizePortfolio(items);

  if (!rows.length) {
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">포트폴리오</h2>
          <p class="desc">표시할 작업물이 없어요.</p>
        </div>
      </div>
    `.trim();
    return;
  }

  const slidesHtml = rows
    .map((r, idx) => {
      const vid = extractYouTubeId(r.url);
      const candidates = buildYouTubeThumbCandidates(vid);
      const thumb = candidates[0] || "";
      const srcsJson = escapeHtml(JSON.stringify(candidates));

      const safeTitle = escapeHtml(r.title || "작업물");
      const safeDesc = r.desc ? nl2br(r.desc) : "";

      return `
        <article class="pfSlide" role="group" aria-label="${idx + 1} / ${rows.length}">
          <a class="pfCard"
             href="${escapeHtml(r.url)}"
             target="_blank" rel="noopener"
             draggable="false">
            <div class="pfThumb">
              ${
                thumb
                  ? `<img class="pfThumb__img"
                        src="${escapeHtml(thumb)}"
                        data-srcs="${srcsJson}"
                        data-step="0"
                        alt="${safeTitle} 썸네일"
                        draggable="false"
                        loading="${idx === 0 ? "eager" : "lazy"}" />`
                  : `<div class="pfThumb__empty">Thumbnail</div>`
              }
              <div class="pfThumb__overlay" aria-hidden="true">
                <span class="pfThumb__cta">YouTube로 보기</span>
              </div>
            </div>

            <div class="pfBody">
              ${r.title ? `<h3 class="pfTitle">${safeTitle}</h3>` : ""}
              ${r.desc ? `<p class="pfDesc">${safeDesc}</p>` : ""}
            </div>
          </a>
        </article>
      `.trim();
    })
    .join("");

  const dotsHtml = rows
    .map((_, i) => `<button class="pfDot" type="button" aria-label="${i + 1}번째 슬라이드"></button>`)
    .join("");

  mountEl.innerHTML = `
    <div class="secBox">
      <div class="head">
        <h2 class="title">포트폴리오</h2>
        <p class="desc">썸네일을 클릭하면 유튜브로 이동해요.</p>
      </div>

      <div class="pfSlider" data-pf="slider" aria-roledescription="carousel">
        <button class="pfNav pfNav--prev" type="button" aria-label="이전">‹</button>

        <div class="pfViewport" aria-live="polite">
          <div class="pfTrack">
            ${slidesHtml}
          </div>
        </div>

        <button class="pfNav pfNav--next" type="button" aria-label="다음">›</button>
      </div>

      <div class="pfDots" data-pf="dots">
        ${dotsHtml}
      </div>
    </div>
  `.trim();

  attachThumbFallback(mountEl);
  initPortfolioSlider(mountEl);
}

/* ---------- slider behavior (click-safe) ---------- */
function initPortfolioSlider(rootEl) {
  const sliderEl = rootEl.querySelector('[data-pf="slider"]');
  if (!sliderEl) return;

  const viewport = sliderEl.querySelector(".pfViewport");
  const track = sliderEl.querySelector(".pfTrack");
  const slides = Array.from(sliderEl.querySelectorAll(".pfSlide"));

  const prevBtn = sliderEl.querySelector(".pfNav--prev");
  const nextBtn = sliderEl.querySelector(".pfNav--next");

  const dotsWrap = rootEl.querySelector('[data-pf="dots"]');
  const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll(".pfDot")) : [];

  let index = 0;

  function clamp(n) {
    return Math.max(0, Math.min(slides.length - 1, n));
  }

  function update() {
    index = clamp(index);
    track.style.transform = `translateX(${-index * 100}%)`;

    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === slides.length - 1;

    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  }

  function go(n) {
    index = clamp(n);
    update();
  }

  prevBtn?.addEventListener("click", () => go(index - 1));
  nextBtn?.addEventListener("click", () => go(index + 1));
  dots.forEach((d, i) => d.addEventListener("click", () => go(i)));

  // keyboard
  sliderEl.tabIndex = 0;
  sliderEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  });

  let downX = 0;
  let downY = 0;
  let dragging = false;
  let moved = false;

  const MOVE_TO_DRAG = 6;
  const SWIPE_THRESHOLD = 40;

  viewport?.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
  });

  viewport?.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - downX;
    const dy = e.clientY - downY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MOVE_TO_DRAG) {
      moved = true;
      e.preventDefault();
    }
  }, { passive: false });

  viewport?.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;

    if (!moved) return;

    const dx = e.clientX - downX;
    if (dx > SWIPE_THRESHOLD) go(index - 1);
    else if (dx < -SWIPE_THRESHOLD) go(index + 1);
  });

  viewport?.addEventListener("pointercancel", () => {
    dragging = false;
    moved = false;
  });

  viewport?.addEventListener("click", (e) => {
    if (!moved) return;
    e.preventDefault();
    e.stopPropagation();
    moved = false;
  }, true);

  update();
}

/* ---------- init ---------- */
async function initPortfolioSection() {
  const mountEl = document.querySelector(PORTFOLIO_MOUNT_SELECTOR);
  if (!mountEl) return;

  try {
    const res = await fetch(PORTFOLIO_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    const items = rowsToObjects(rows);

    renderPortfolio(items, mountEl);
  } catch (err) {
    console.error("[portfolio] init failed:", err);
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">포트폴리오</h2>
          <p class="desc">데이터를 불러오지 못했어요.</p>
        </div>
      </div>
    `.trim();
  }
}

document.addEventListener("DOMContentLoaded", initPortfolioSection);







/* =========================
   Form + Quote Calculator
========================= */

const FORM_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=868636933&single=true&output=csv";
const FORM_MOUNT_SELECTOR = "#form";

/* ---------- helpers (namespaced to avoid collisions) ---------- */
function formToKey(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\wㄱ-ㅎ가-힣_]/g, "");
}
function formToNum(v, fallback = 0) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function formMoney(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("ko-KR");
}
function formPickCheckedLabel(rootEl, selectorCheckedInput) {
  const input = rootEl.querySelector(selectorCheckedInput);
  if (!input) return "";
  const txt = input.closest("label")?.querySelector(".formChoice__text")?.textContent ?? "";
  return String(txt).trim();
}
function formFindBlock(formEl, groupNamePart) {
  return Array.from(formEl.querySelectorAll(".formBlock")).find((b) => {
    const g = b.getAttribute("data-group") || "";
    const title = b.querySelector(".formBlock__title")?.textContent || "";
    return g.includes(groupNamePart) || title.includes(groupNamePart);
  });
}
function formGetFirstTextValue(blockEl) {
  if (!blockEl) return "";
  const inp = blockEl.querySelector('input[type="text"]');
  return (inp?.value || "").trim();
}
function formGetTextareaValue(blockEl) {
  if (!blockEl) return "";
  const ta = blockEl.querySelector("textarea");
  return (ta?.value || "").trim();
}

/* ---------- normalize ---------- */
function normalizeFormRows(items) {
  return (items || [])
    .map((it) => {
      const group = String(it.group ?? "").trim();
      let type = String(it.type ?? "").trim().toLowerCase();
      const label = String(it.label ?? "").trim();
      const placeholder = String(it.placeholder ?? "").trim();

      if (!type) type = placeholder.length >= 10 ? "textarea" : "text";

      return {
        order: formToNum(it.order, 9999),
        group,
        type,
        label: label || group,
        placeholder,
        value: String(it.value ?? "").trim(),
        calc_type: String(it.calc_type ?? "").trim().toLowerCase(),
      };
    })
    .filter((r) => r.group);
}

/* ---------- render (includes: merge collab + illustrator) ---------- */
function renderFormSection(formItems, mountEl) {
  const rows = normalizeFormRows(formItems);

  const orderMap = new Map();
  for (const r of rows) {
    if (!orderMap.has(r.order)) orderMap.set(r.order, new Map());
    const gmap = orderMap.get(r.order);
    if (!gmap.has(r.group)) gmap.set(r.group, []);
    gmap.get(r.group).push(r);
  }

  const blocks = [];
  const orders = Array.from(orderMap.keys()).sort((a, b) => a - b);
  for (const o of orders) {
    const gmap = orderMap.get(o);
    const gnames = Array.from(gmap.keys());

    gnames.sort((a, b) => a.localeCompare(b, "ko"));
    for (const g of gnames) {
      const grows = gmap.get(g) || [];
      blocks.push({ order: o, group: g, type: grows[0]?.type || "", rows: grows });
    }
  }

  const merged = [];
  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i];
    const next = blocks[i + 1];

    const isCollab = cur?.group?.includes("협업작가");
    const isIllust =
      next?.group?.includes("일러레") || next?.group?.includes("일러스트레이터");

    if (isCollab && isIllust) {
      merged.push({
        order: cur.order,
        group: "협업 / 일러레 정보",
        type: "merge_collab_illust",
        rows: cur.rows,
        extraRows: next.rows,
      });
      i++;
      continue;
    }
    merged.push(cur);
  }

  const span3 = (gname = "", type = "") => {
    if (
      type === "textarea" ||
      gname.includes("개당 추가 옵션") ||
      gname.includes("일반 추가 옵션") ||
      gname.includes("협업") ||
      gname.includes("포트폴리오 비공개")
    ) return " formBlock--span3";
    return "";
  };

  let html = `
    <div class="secBox">
      <div class="head">
        <h2 class="title">신청 양식</h2>
        <p class="desc">아래 금액은 참고용 최소 금액입니다. 상담 후 정확한 견적 안내가 가능합니다.</p>
      </div>

      <form class="quoteForm" autocomplete="off">
        <div class="formGrid">
  `.trim();

  for (const b of merged) {
    const type = String(b.type || "").toLowerCase();
    const gname = b.group;
    const key = formToKey(gname);

    html += `
      <section class="formBlock card card--soft${span3(gname, type)}" data-group="${escapeHtml(gname)}">
        <h3 class="formBlock__title">${escapeHtml(gname)}</h3>
    `.trim();

    // merged block
    if (type === "merge_collab_illust") {
      const collabNameKey = formToKey("협업작가");

      html += `<div class="formChoices formChoices--wrap">`;
      for (const r of b.rows) {
        html += `
          <label class="formChoice">
            <input type="radio" name="${escapeHtml(collabNameKey)}"
              value='${escapeHtml(JSON.stringify({ v: r.value, t: r.calc_type, label: r.label }))}'>
            <span class="formChoice__text">${escapeHtml(r.label)}</span>
          </label>
        `.trim();
      }
      html += `</div>`;

      // illustrator info
      const illuKey = formToKey("일러레_정보");
      for (let i = 0; i < (b.extraRows || []).length; i++) {
        const r = b.extraRows[i];
        const inputName = `${illuKey}__${formToKey(r.label || `info_${i}`)}`;
        html += `
          <label class="formField formField--sub">
            <span class="formLabel">${escapeHtml(r.label || "일러스트레이터 정보")}</span>
            <input class="formInput" type="text" name="${escapeHtml(inputName)}"
              placeholder="${escapeHtml(r.placeholder || "")}">
          </label>
        `.trim();
      }

      html += `</section>`;
      continue;
    }

    // text
    if (type === "text") {
      for (let i = 0; i < b.rows.length; i++) {
        const r = b.rows[i];
        const inputName = `${key}__${formToKey(r.label || `input_${i}`)}`;
        html += `
          <label class="formField">
            <span class="formLabel">${escapeHtml(r.label || gname)}</span>
            <input class="formInput" type="text" name="${escapeHtml(inputName)}"
              placeholder="${escapeHtml(r.placeholder || "")}">
          </label>
        `.trim();
      }
    }
    // textarea
    else if (type === "textarea") {
      const r = b.rows[0];
      html += `
        <label class="formField">
          <span class="formLabel">${escapeHtml(r.label || gname)}</span>
          <textarea class="formTextarea" name="${escapeHtml(key)}"
            placeholder="${escapeHtml(r.placeholder || "")}"></textarea>
        </label>
      `.trim();
    }
    // radio
    else if (type === "radio") {
      html += `<div class="formChoices formChoices--wrap">`;
      for (const r of b.rows) {
        html += `
          <label class="formChoice">
            <input type="radio" name="${escapeHtml(key)}"
              value='${escapeHtml(JSON.stringify({ v: r.value, t: r.calc_type, label: r.label }))}'>
            <span class="formChoice__text">${escapeHtml(r.label)}</span>
          </label>
        `.trim();
      }
      html += `</div>`;
    }
    // checkbox
    else if (type === "checkbox") {
      html += `<div class="formChoices formChoices--grid">`;
      for (const r of b.rows) {
        html += `
          <label class="formChoice">
            <input type="checkbox"
              value='${escapeHtml(JSON.stringify({ v: r.value, t: r.calc_type, label: r.label }))}'>
            <span class="formChoice__text">${escapeHtml(r.label)}</span>
          </label>
        `.trim();
      }
      html += `</div>`;
    }
    // number (unit)
    else if (type === "number") {
      html += `<div class="formUnits formUnits--2col">`;
      for (const r of b.rows) {
        html += `
          <label class="formUnitRow">
            <span class="formUnitRow__label">${escapeHtml(r.label)}</span>
            <input class="formUnitRow__input" type="number" min="0" step="1" value="0"
              data-pack='${escapeHtml(JSON.stringify({ unit: r.value, label: r.label }))}'>
            <span class="formUnitRow__hint">${formMoney(r.value)}원 / 개</span>
          </label>
        `.trim();
      }
      html += `</div>`;
    }

    html += `</section>`;
  }

  html += `
        </div>

        <section class="quoteBox card">
          <div class="quoteBox__top">
            <h3 class="quoteBox__title">예상 견적</h3>
            <strong class="quoteBox__sumVal" data-quote-total>0원</strong>
          </div>

          <div class="quoteBox__detail" data-quote-detail></div>

          <div class="quoteBox__actions">
            <button type="button" class="btn btn--primary" data-quote-copy>견적서 복사</button>
            <button type="button" class="btn btn--ghost" data-quote-reset>초기화</button>
          </div>
        </section>
      </form>
    </div>
  `.trim();

  mountEl.innerHTML = html;
}

/* ---------- quote calc (compact) ---------- */
function computeQuote(formEl) {
  let addTotal = 0;
  let discountTotal = 0;
  let multiplier = 1;

  // radio
  formEl.querySelectorAll('input[type="radio"]:checked').forEach((i) => {
    let d = {};
    try { d = JSON.parse(i.value); } catch { d = { v: i.value, t: "" }; }
    const t = String(d.t || "").toLowerCase();
    const v = formToNum(d.v, 0);

    if (t === "discount") discountTotal += v;
    else if (t === "mult") multiplier = v || 1;
    else addTotal += v;
  });

  // checkbox
  formEl.querySelectorAll('input[type="checkbox"]:checked').forEach((i) => {
    let d = {};
    try { d = JSON.parse(i.value); } catch { d = { v: i.value, t: "add" }; }
    const t = String(d.t || "add").toLowerCase();
    const v = formToNum(d.v, 0);
    if (t === "discount") discountTotal += v;
    else addTotal += v;
  });

  // number units
  formEl.querySelectorAll(".formUnitRow__input").forEach((inp) => {
    const qty = Math.max(0, formToNum(inp.value, 0));
    if (!qty) return;

    let pack = {};
    try { pack = JSON.parse(inp.dataset.pack || "{}"); } catch {}
    const unit = formToNum(pack.unit, 0);

    addTotal += unit * qty;
  });

  const base = Math.max(0, addTotal - discountTotal);
  const total = Math.round(base * (multiplier || 1));

  return { addTotal, discountTotal, base, multiplier, total };
}

function renderQuote(formEl) {
  const { addTotal, discountTotal, base, multiplier, total } = computeQuote(formEl);
  const totalEl = formEl.querySelector("[data-quote-total]");
  const detailEl = formEl.querySelector("[data-quote-detail]");

  if (totalEl) totalEl.textContent = `${formMoney(total)}원`;

  const pct = multiplier && multiplier !== 1 ? Math.round((multiplier - 1) * 100) : 0;

  if (detailEl) {
    detailEl.innerHTML = `
      <div class="quoteMini">
        <div class="quoteRow"><span class="quoteKey">기본/추가 합</span><span class="quoteVal">+ ${formMoney(addTotal)}원</span></div>
        ${discountTotal ? `<div class="quoteRow"><span class="quoteKey">협업 할인</span><span class="quoteVal">- ${formMoney(discountTotal)}원</span></div>` : ""}
        <div class="quoteRow"><span class="quoteKey">소계</span><span class="quoteVal">${formMoney(base)}원</span></div>
        ${multiplier !== 1 ? `<div class="quoteRow"><span class="quoteKey">비공개 옵션</span><span class="quoteVal">× ${multiplier} (+${pct}%)</span></div>` : ""}
      </div>
    `.trim();
  }
}

/* ---------- copy text (the template you requested) ---------- */
function buildFormCopyText(formEl) {
  const bPlatform = formFindBlock(formEl, "방송 플랫폼");
  const bNick = formFindBlock(formEl, "방송 닉네임");
  const bRig = formFindBlock(formEl, "리깅 옵션");
  const bUnit = formFindBlock(formEl, "개당 추가 옵션");
  const bChk = formFindBlock(formEl, "일반 추가 옵션");
  const bExpr = formFindBlock(formEl, "표정");
  const bCollab = formFindBlock(formEl, "협업");
  const bPrivacy = formFindBlock(formEl, "포트폴리오 비공개");
  const bExtra = formFindBlock(formEl, "추가 문의사항");

  const platform = formGetFirstTextValue(bPlatform);
  const nickname = formGetFirstTextValue(bNick);

  const rigOpt = bRig ? formPickCheckedLabel(bRig, 'input[type="radio"]:checked') : "";

  const addParts = [];

  if (bUnit) {
    bUnit.querySelectorAll(".formUnitRow__input").forEach((inp) => {
      const qty = Math.max(0, formToNum(inp.value, 0));
      if (!qty) return;

      let pack = {};
      try { pack = JSON.parse(inp.dataset.pack || "{}"); } catch {}
      const label = String(pack.label || "").trim();
      if (!label) return;

      addParts.push(`${label} × ${qty}`);
    });
  }

  if (bChk) {
    bChk.querySelectorAll('input[type="checkbox"]:checked').forEach((chk) => {
      const label = chk.closest("label")?.querySelector(".formChoice__text")?.textContent ?? "";
      const s = String(label).trim();
      if (s) addParts.push(s);
    });
  }

  const addOpt = addParts.length ? addParts.join(", ") : "";

  const expr = formGetTextareaValue(bExpr);

  // 협업/일러레 정보
  let collabName = "";
  let illustInfo = "";
  if (bCollab) {
    collabName = formPickCheckedLabel(bCollab, `input[name="${formToKey("협업작가")}"]:checked`);
    const infos = Array.from(bCollab.querySelectorAll('input[type="text"]'))
      .map((i) => (i.value || "").trim())
      .filter(Boolean);
    illustInfo = infos.join(" / ");
  }

  const privacy = bPrivacy ? formPickCheckedLabel(bPrivacy, 'input[type="radio"]:checked') : "";
  const extra = formGetTextareaValue(bExtra);

  return [
    "💌 리깅 신청 양식",
    `방송 플랫폼: ${platform}`,
    `방송 닉네임: ${nickname}`,
    `리깅 옵션: ${rigOpt}`,
    `추가 옵션: ${addOpt}`,
    `표정: ${expr}`,
    `일러스트레이터 정보: [${collabName}] ${illustInfo}`,
    `포트폴리오 공개: ${privacy}`,
    `추가 문의사항: ${extra}`,
  ].join("\n");
}

/* ---------- events ---------- */
function attachFormEvents(mountEl) {
  const formEl = mountEl.querySelector(".quoteForm");
  if (!formEl) return;

  const btnCopy = mountEl.querySelector("[data-quote-copy]");
  const btnReset = mountEl.querySelector("[data-quote-reset]");

  const rerender = () => renderQuote(formEl);

  // live update
  formEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t && t.matches('input[type="number"]')) {
      const n = Math.max(0, formToNum(t.value, 0));
      if (String(n) !== String(t.value)) t.value = String(n);
    }
    rerender();
  });
  formEl.addEventListener("change", rerender);

  // reset (hard reset)
  btnReset?.addEventListener("click", () => {
    formEl.reset();
    formEl.querySelectorAll('input[type="number"]').forEach((n) => (n.value = "0"));
    formEl.querySelectorAll("textarea").forEach((t) => (t.value = ""));
    formEl.querySelectorAll('input[type="text"]').forEach((t) => (t.value = ""));
    rerender();
  });

  // copy (full template + feedback)
  btnCopy?.addEventListener("click", async () => {
    const text = buildFormCopyText(formEl);

    try {
      await navigator.clipboard.writeText(text);

      if (btnCopy) {
        const prev = btnCopy.textContent;
        btnCopy.textContent = "복사 완료!";
        btnCopy.classList.add("is-copied");

        window.clearTimeout(btnCopy._t);
        btnCopy._t = window.setTimeout(() => {
          btnCopy.textContent = prev;
          btnCopy.classList.remove("is-copied");
        }, 1200);
      }
    } catch (e) {
      window.prompt("아래 내용을 복사하세요:", text);
    }
  });

  // initial
  rerender();
}

/* ---------- init ---------- */
async function initFormSection() {
  const mountEl = document.querySelector(FORM_MOUNT_SELECTOR);
  if (!mountEl) return;

  try {
    const res = await fetch(FORM_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const csvRows = parseCsv(csvText);
    const items = rowsToObjects(csvRows);

    renderFormSection(items, mountEl);
    attachFormEvents(mountEl);
  } catch (err) {
    console.error("[form] init failed:", err);
    mountEl.innerHTML = `
      <div class="secBox">
        <div class="head">
          <h2 class="title">신청 양식</h2>
          <p class="desc">데이터를 불러오지 못했어요.</p>
        </div>
      </div>
    `.trim();
  }
}

document.addEventListener("DOMContentLoaded", initFormSection);


(function () {
  function bindGoto() {
    document.querySelectorAll('a[name="goto"]').forEach(a => {
      if (a.__gotoBound) return;
      a.__gotoBound = true;

      a.addEventListener("click", e => {
        e.preventDefault();

        const targetId = a.getAttribute("href");
        if (!targetId) return;

        const target =
          document.getElementById(targetId) ||
          document.querySelector(`[name="${targetId}"]`);

        if (!target) {
          console.warn("[goto] target not found:", targetId);
          return;
        }

        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest"
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", bindGoto);

  window.addEventListener("load", bindGoto);

  setTimeout(bindGoto, 800);
})();




/* =========================
   Intro Slider
========================= */
const INTRO_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWd5AZ1ITQ3onX3jRQmS0pD_T5hDwpDPluZPA6GSXu1zrvS1w4nhQ-64U1aBwIBMNuT0D5yLmB34UK/pub?gid=1348701818&single=true&output=csv";

function normalizeIntroSlides(items) {
  const cleaned = (items || [])
    .map((it) => ({
      order: Number(String(it.order ?? "").trim()) || 9999,
      thumb: String(it.thumb ?? "").trim(),
    }))
    .filter((it) => it.thumb);

  cleaned.sort((a, b) => a.order - b.order);

  return cleaned.map((it) => ({
    ...it,
    src: toGoogleusercontent(it.thumb, { size: "w1600" }),
    alt: `Intro slide ${it.order}`,
  }));
}

function renderIntroSlider(slides, rootEl) {
  const sliderEl = rootEl.querySelector('[data-intro="slider"]');
  const track = sliderEl?.querySelector(".introTrack");
  const dotsWrap = rootEl.querySelector('[data-intro="dots"]');

  if (!sliderEl || !track || !dotsWrap) return;

  if (!slides.length) {
    track.innerHTML = `
      <div class="introSlide">
        <div style="padding:18px;color:var(--text-soft)">표시할 이미지가 없어요.</div>
      </div>
    `.trim();
    return;
  }

  const slidesHtml = slides
    .map((s, idx) => {
      const loading = idx === 0 ? "eager" : "lazy";
      return `
        <article class="introSlide" role="group" aria-label="${idx + 1} / ${slides.length}">
          <img class="introSlide__img"
               src="${escapeHtml(s.src)}"
               alt="${escapeHtml(s.alt)}"
               draggable="false"
               loading="${loading}">
        </article>
      `.trim();
    })
    .join("");

  track.innerHTML = slidesHtml;

  dotsWrap.innerHTML = slides
    .map((_, i) => `<button class="introDot" type="button" aria-label="${i + 1}번째 슬라이드"></button>`)
    .join("");

  initIntroSlider(rootEl, slides.length);
}

function initIntroSlider(rootEl, total) {
  const sliderEl = rootEl.querySelector('[data-intro="slider"]');
  if (!sliderEl) return;

  const viewport = sliderEl.querySelector(".introViewport");
  const track = sliderEl.querySelector(".introTrack");
  const slides = Array.from(sliderEl.querySelectorAll(".introSlide"));

  const prevBtn = sliderEl.querySelector(".introNav--prev");
  const nextBtn = sliderEl.querySelector(".introNav--next");

  const dotsWrap = rootEl.querySelector('[data-intro="dots"]');
  const dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll(".introDot")) : [];

  let index = 0;

  function clampLoop(n) {
    if (total <= 1) return 0;
    if (n < 0) return total - 1;
    if (n >= total) return 0;
    return n;
  }

  function update() {
    index = clampLoop(index);
    track.style.transform = `translateX(${-index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  }

  function go(n) {
    index = clampLoop(n);
    update();
  }

  prevBtn?.addEventListener("click", () => go(index - 1));
  nextBtn?.addEventListener("click", () => go(index + 1));
  dots.forEach((d, i) => d.addEventListener("click", () => go(i)));

  // keyboard
  sliderEl.tabIndex = 0;
  sliderEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  });

  let downX = 0;
  let downY = 0;
  let dragging = false;
  let moved = false;

  const MOVE_TO_DRAG = 6;
  const SWIPE_THRESHOLD = 40;

  viewport?.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
  });

  viewport?.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;

      const dx = e.clientX - downX;
      const dy = e.clientY - downY;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MOVE_TO_DRAG) {
        moved = true;
        e.preventDefault();
      }
    },
    { passive: false }
  );

  viewport?.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;

    if (!moved) return;

    const dx = e.clientX - downX;
    if (dx > SWIPE_THRESHOLD) go(index - 1);
    else if (dx < -SWIPE_THRESHOLD) go(index + 1);
  });

  viewport?.addEventListener("pointercancel", () => {
    dragging = false;
    moved = false;
  });

  viewport?.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    },
    true
  );

  if (total <= 1) {
    prevBtn && (prevBtn.style.display = "none");
    nextBtn && (nextBtn.style.display = "none");
  }

  update();
}

async function initIntroSectionSlider() {
  const introEl = document.querySelector("#intro");
  if (!introEl) return;

  try {
    const res = await fetch(INTRO_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const csvText = await res.text();

    const rows = parseCsv(csvText);
    const items = rowsToObjects(rows);

    const slides = normalizeIntroSlides(items);
    renderIntroSlider(slides, introEl);
  } catch (err) {
    console.error("[intro] slider init failed:", err);
    const track = document.querySelector("#intro .introTrack");
    if (track) {
      track.innerHTML = `
        <div class="introSlide">
          <div style="padding:18px;color:var(--text-soft)">슬라이드를 불러오지 못했어요.</div>
        </div>
      `.trim();
    }
  }
}

document.addEventListener("DOMContentLoaded", initIntroSectionSlider);


function initCollabFold() {
  const section = document.querySelector("#collab");
  if (!section) return;

  const headBtn = section.querySelector(".collabHead");
  const panel = section.querySelector("#collabPanel");
  if (!headBtn || !panel) return;

  section.classList.remove("is-open");
  headBtn.setAttribute("aria-expanded", "false");

  panel.style.display = "none";
  panel.style.height = "0px";
  panel.style.overflow = "hidden";

  headBtn.addEventListener("click", () => {
    const isOpen = section.classList.contains("is-open");

    if (isOpen) {
      // 닫기
      section.classList.remove("is-open");
      headBtn.setAttribute("aria-expanded", "false");
      closeAccordion(panel);
    } else {
      // 열기
      section.classList.add("is-open");
      headBtn.setAttribute("aria-expanded", "true");
      openAccordion(panel);
    }
  });
}

document.addEventListener("DOMContentLoaded", initCollabFold);