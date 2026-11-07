/*
  Mayhem site script. You shouldn't need to edit this file.
  Everything about products and quotations lives in data/shop.js.
*/
(function () {
  "use strict";

  var D = window.MAYHEM || {};
  var TZ = "America/Halifax";
  var page = document.body.getAttribute("data-page") || "";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- small helpers ---------------- */

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function money(v) {
    if (!isNum(v)) return null;
    var s = v % 1 === 0 ? String(v) : v.toFixed(2);
    return "C$" + s;
  }
  function q(kind) { return '<span class="q q--' + kind + '" aria-hidden="true"></span>'; }
  function quoted(label) { return q("open") + "<span>" + label + "</span>" + q("close"); }

  /* ---------------- Halifax time ---------------- */

  var partsFmt = null;
  try {
    partsFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  } catch (e) { partsFmt = null; }

  function tzOffsetAt(ms) {
    if (!partsFmt) return -4 * 3600000;
    var p = {};
    partsFmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUTC - Math.floor(ms / 1000) * 1000;
  }

  // "2026-12-01 18:00" in Halifax time -> Date
  function halifax(str) {
    if (!str || typeof str !== "string") return null;
    var m = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    var guess = Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0);
    var t = guess - tzOffsetAt(guess);
    t = guess - tzOffsetAt(t);
    var d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDateTime(d) {
    if (!d) return null;
    try {
      return d.toLocaleString("en-CA", {
        timeZone: TZ, weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZoneName: "short"
      });
    } catch (e) { return d.toString(); }
  }
  function fmtDate(d) {
    if (!d) return null;
    try {
      return d.toLocaleDateString("en-CA", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch (e) { return d.toDateString(); }
  }

  /* ---------------- data access ---------------- */

  var drops = Array.isArray(D.quotations) ? D.quotations : (Array.isArray(D.drops) ? D.drops : []);
  var products = Array.isArray(D.products) ? D.products : [];
  var presets = D.presets || {};
  var shipping = D.shipping || {};

  function dropById(id) {
    for (var i = 0; i < drops.length; i++) if (drops[i] && drops[i].id === id) return drops[i];
    return null;
  }
  // a product says which quotation it belongs to
  function pDrop(p) { return p ? (p.quotation || p.drop) : null; }
  function currentDrop() { return dropById(D.currentQuotation || D.currentDrop) || drops[0] || null; }

  function dropState(drop) {
    if (!drop) return { state: "none" };
    var open = halifax(drop.opens), close = halifax(drop.closes), now = Date.now();
    if (!open) return { state: "tba", open: open, close: close };
    if (now < open.getTime()) return { state: "upcoming", open: open, close: close, target: open };
    if (close && now >= close.getTime()) return { state: "closed", open: open, close: close };
    return { state: "open", open: open, close: close, target: close };
  }

  // merge a product with its preset
  function full(p) {
    var pre = presets[p.type] || {};
    var out = {};
    var k;
    for (k in pre) out[k] = pre[k];
    for (k in p) if (p[k] !== undefined) out[k] = p[k];
    out.colours = Array.isArray(p.colours) ? p.colours.filter(Boolean) : [];
    out.details = Array.isArray(out.details) ? out.details.filter(function (r) { return r && r[1]; }) : [];
    return out;
  }

  function visibleProducts(dropId) {
    return products.filter(function (p) {
      return p && p.status !== "hidden" && (!dropId || pDrop(p) === dropId);
    }).map(full);
  }

  function findProduct(id) {
    for (var i = 0; i < products.length; i++) {
      if (products[i] && products[i].id === id && products[i].status !== "hidden") return full(products[i]);
    }
    return null;
  }


  // only a real, full https:// address counts as a Stripe link
  function validLink(u) {
    if (typeof u !== "string" || !/^https:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u.trim())) return false;
    try { return new URL(u.trim()).protocol === "https:"; } catch (e) { return false; }
  }

  // the delivery line for a quotation, with its dates filled in
  function deliveryText(drop) {
    var d = drop && drop.delivery;
    if (!d || typeof d.text !== "string" || !d.text) return null;
    return d.text.replace(/\{shipsBy\}/g, d.shipsBy || "").replace(/\{arriveBy\}/g, d.arriveBy || "");
  }

  // what the buy button should do for this product
  function buyState(p) {
    if (p.status === "soldout") return { ok: false, label: "Sold out" };
    if (p.status === "closed") return { ok: false, label: "Pre-orders closed" };
    if (p.status === "upcoming") {
      var ds = dropState(dropById(pDrop(p)));
      if (ds.state === "upcoming" && ds.open) return { ok: false, label: "Opens " + shortDate(ds.open) };
      return { ok: false, label: "Coming soon" };
    }
    if (p.status === "open") {
      if (!validLink(p.stripeLink)) return { ok: false, label: "Link coming soon" };
      return { ok: true, label: "Pre-order", href: p.stripeLink };
    }
    return { ok: false, label: "Coming soon" };
  }
  function shortDate(d) {
    try { return d.toLocaleDateString("en-CA", { timeZone: TZ, month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  function buyButton(p, extra) {
    var s = buyState(p);
    var cls = "btn btn--block " + (extra || "");
    if (s.ok && validLink(s.href)) {
      return '<a class="' + cls + '" href="' + esc(s.href.trim()) + '" rel="noopener" data-checkout>' + quoted(esc(s.label)) + "</a>";
    }
    return '<span class="' + cls + '" role="link" aria-disabled="true">' + esc(s.ok ? "Link coming soon" : s.label) + "</span>";
  }

  function policyLine(p) {
    var dt = deliveryText(dropById(pDrop(p)) || currentDrop());
    return '<p class="fine">All sales final. <a href="policy.html">Policies</a>' +
      (dt ? '<span class="fine__delivery"> ' + esc(dt) + "</span>" : "") + "</p>";
  }

  function priceText(p) { return money(p.price) || "Price TBA"; }
  function availText(p) {
    if (!isNum(p.available)) return "";
    return Math.max(0, Math.floor(p.available)) + " available";
  }

  /* ---------------- contact (built at runtime) ---------------- */

  function addressText(a) {
    if (!a || typeof a !== "object") return null;
    var parts = [a.number, a.street, a.town, a.province, a.postal];
    for (var i = 0; i < parts.length; i++) if (!parts[i]) return null;
    return a.number + " " + a.street + ", " + a.town + " " + a.province + " " + a.postal;
  }

  // full = policy page (shows the address). The footer only links to it.
  function contactHTML(full) {
    var c = D.contact || {};
    var email = c.emailUser && c.emailDomain ? c.emailUser + "@" + c.emailDomain : null;
    var phone = Array.isArray(c.phone) ? c.phone.join(" ") : null;
    var tel = Array.isArray(c.phone) ? "+1" + c.phone.join("") : null;
    var rows = [];
    rows.push(["Seller", esc(c.name || "") + ", sole proprietor, selling as Mayhem"]);
    rows.push(["Email", email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + "</a>" : '<span class="todo">Email TBA</span>']);
    rows.push(["Phone", phone ? '<a href="tel:' + esc(tel) + '">' + esc(phone) + "</a>" : '<span class="todo">Phone TBA</span>']);
    if (full) {
      var addr = addressText(c.address);
      rows.push(["Address", addr ? esc(addr) : '<span class="todo">Address coming soon</span>']);
    } else {
      rows.push(["Address", '<a href="policy.html#contact">On the Policies page</a>']);
    }
    return '<dl class="contact">' + rows.map(function (r) {
      return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>";
    }).join("") + "</dl>" +
      '<p class="notice">"This contact information is provided only for questions about Mayhem orders. Any misuse of it, including harassment, threats, spam, impersonation, or sharing or publishing it elsewhere, will be documented and may result in legal action against you, including civil claims and reports to police."</p>';
  }

  function payHTML() {
    var list = Array.isArray(D.paymentMethods) ? D.paymentMethods.filter(Boolean) : [];
    if (!list.length) return "";
    return '<div class="pay"><span class="pay__label mono">Checkout accepts</span><ul class="pay__list">' +
      list.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul></div>";
  }

  function socialsHTML() {
    var list = Array.isArray(D.socials) ? D.socials.filter(function (s) { return s && /^https:\/\//i.test(s.url || ""); }) : [];
    if (!list.length) return "";
    return '<ul class="socials" aria-label="Mayhem on social media">' + list.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        '<span class="socials__name mono">' + esc(s.name) + "</span>" +
        '<span class="socials__handle">' + esc(s.handle || "") + "</span></a></li>";
    }).join("") + "</ul>";
  }

  // pink delivery bar fixed to the bottom of every page. The page gets
  // bottom padding equal to the bar's height so nothing ends up behind it.
  function renderBar() {
    var dt = deliveryText(currentDrop());
    if (!dt) return;
    var bar = document.createElement("div");
    bar.className = "delivery-bar";
    bar.setAttribute("role", "note");
    bar.textContent = dt;
    document.body.appendChild(bar);
    function fit() { document.documentElement.style.setProperty("--bar-h", bar.offsetHeight + "px"); }
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(bar);
    else window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* ---------------- header and footer ---------------- */

  function renderChrome() {
    var h = $("#site-header");
    if (h) {
      var links = [["index.html", "Shop", "shop"], ["index.html#checkpoint", "Shipping", "shipping"], ["size-guide.html", "Size guide", "sizes"], ["policy.html", "Policies", "policy"]];
      h.className = "site-header";
      h.innerHTML = '<div class="wrap">' +
        '<a class="brand" href="index.html"><img src="assets/logos/Mayhem-wild-logo-black.svg" alt="Mayhem" width="160" height="29"></a>' +
        '<nav class="nav" aria-label="Main">' + links.map(function (l) {
          var cur = (l[2] === page) ? ' aria-current="page"' : "";
          return '<a href="' + l[0] + '"' + cur + ">" + l[1] + "</a>";
        }).join("") + "</nav></div>";
    }
    var f = $("#site-footer");
    if (f) {
      f.className = "site-footer";
      f.innerHTML = '<div class="site-footer__q" aria-hidden="true">' + q("close") + "</div>" +
        '<div class="wrap"><div class="site-footer__grid">' +
          '<div class="site-footer__brand">' +
            '<img src="assets/logos/Mayhem-wild-logo-white.svg" alt="Mayhem" width="220" height="40">' +
            '<div class="site-footer__links">' +
              '<a href="index.html">Shop</a><a href="index.html#checkpoint">Shipping</a><a href="size-guide.html">Size guide</a><a href="policy.html">Policies</a>' +
            "</div>" +
            socialsHTML() + payHTML() +
          "</div>" +
        "</div>" +
        '<p class="site-footer__legal">A Canadian brand. Ships to Canada only. Prices in Canadian dollars. Times are Halifax time.</p>' +
        "</div>";
    }
  }

  /* ---------------- shop page ---------------- */

  /* ---------------- image viewer ----------------
     One image per product. The colour buttons switch which colour you're
     looking at, and the arrow flips it to show the back. This is for
     viewing only. Size and colour are still picked on Stripe.          */

  var FLIP_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function viewerStage(p, href, start) {
    var c = p.colours[start] || p.colours[0];
    if (!c || !c.image) {
      var ph = '<div class="viewer__card"><div class="placeholder">' + q("open") + q("close") + "</div></div>";
      return href ? '<a class="viewer__link" href="' + href + '" aria-label="' + esc(p.name) + '">' + ph + "</a>" : ph;
    }
    var hasBack = p.colours.some(function (x) { return x.back; });
    var card = '<div class="viewer__card">' +
      '<img class="viewer__face viewer__face--front" src="' + esc(c.image) + '" alt="' + esc(p.name + " in " + c.name + ", front") + '" width="1000" height="1000">' +
      '<img class="viewer__face viewer__face--back" src="' + esc(c.back || c.image) + '" alt="' + esc(p.name + " in " + c.name + ", back") + '" width="1000" height="1000" loading="lazy">' +
      "</div>";
    return (href ? '<a class="viewer__link" href="' + href + '" aria-label="' + esc(p.name) + '">' + card + "</a>" : card) +
      (hasBack ? '<button type="button" class="viewer__flip" aria-pressed="false" aria-label="Show the back">' + FLIP_ICON + '<span class="viewer__flip-label">Back</span></button>' : "");
  }

  function swatchButtons(p, withNumbers) {
    return p.colours.map(function (c, i) {
      return '<button type="button" class="swatch" data-colour="' + i + '" aria-pressed="' + (i === 0) + '">' +
        '<span class="chip" style="background:' + esc(c.band || "#999") + '"></span>' +
        '<span class="swatch__name">' + esc(c.name) + "</span>" +
        (withNumbers && c.number ? '<span class="num mono">' + esc(c.number) + "</span>" : "") +
        "</button>";
    }).join("");
  }

  // wires up every [data-viewer] block inside root
  function bindViewers(root, products) {
    Array.prototype.forEach.call((root || document).querySelectorAll("[data-viewer]"), function (box) {
      var p = products[box.getAttribute("data-viewer")];
      if (!p) return;
      var stage = box.querySelector(".viewer");
      var front = box.querySelector(".viewer__face--front");
      var back = box.querySelector(".viewer__face--back");
      var flip = box.querySelector(".viewer__flip");
      var label = box.querySelector(".viewer__flip-label");
      var swatches = box.querySelectorAll(".swatch");
      var state = p._view || (p._view = { colour: 0, back: false });

      function show() {
        var c = p.colours[state.colour] || p.colours[0];
        if (!c || !front) return;
        var hasBack = !!c.back;
        if (!hasBack) state.back = false;
        if (front.getAttribute("src") !== c.image) {
          stage.classList.add("is-swapping");
          front.onload = function () { stage.classList.remove("is-swapping"); };
          front.src = c.image;
        }
        if (back) { back.src = c.back || c.image; back.alt = p.name + " in " + c.name + ", back"; }
        front.alt = p.name + " in " + c.name + ", front";
        stage.classList.toggle("is-back", state.back);
        if (flip) {
          flip.hidden = !hasBack;
          flip.setAttribute("aria-pressed", String(state.back));
          flip.setAttribute("aria-label", state.back ? "Show the front" : "Show the back");
          if (label) label.textContent = state.back ? "Front" : "Back";
        }
        Array.prototype.forEach.call(swatches, function (s) {
          s.setAttribute("aria-pressed", String(+s.getAttribute("data-colour") === state.colour));
        });
      }

      if (flip) flip.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        state.back = !state.back; show();
      });
      Array.prototype.forEach.call(swatches, function (s) {
        s.addEventListener("click", function () { state.colour = +s.getAttribute("data-colour"); show(); });
        // warm the cache so switching feels instant
        s.addEventListener("pointerenter", function () {
          var c = p.colours[+s.getAttribute("data-colour")];
          if (c) { if (c.image) new Image().src = c.image; if (c.back) new Image().src = c.back; }
        }, { once: true });
      });
      show();
    });
  }

  var tileProducts = {};

  function tileHTML(p, idx) {
    var key = "t" + idx;
    tileProducts[key] = p;
    var href = "product.html?p=" + encodeURIComponent(p.id || "");
    return '<article class="tile reveal" data-viewer="' + key + '">' +
      '<div class="tile__media viewer">' + viewerStage(p, href, 0) +
        '<span class="tile__corner tile__corner--tl" aria-hidden="true">' + q("open") + "</span>" +
        '<span class="tile__corner tile__corner--br" aria-hidden="true">' + q("close") + "</span>" +
      "</div>" +
      '<div class="tile__body">' +
        '<h3 class="tile__name"><a href="' + href + '">' + esc(p.name) + "</a></h3>" +
        '<div class="tile__row"><span class="tile__price">' + esc(priceText(p)) + "</span>" +
          (availText(p) ? '<span class="tile__avail mono">' + esc(availText(p)) + "</span>" : "") + "</div>" +
        (p.colours.length ? '<div class="swatches" role="group" aria-label="View colour">' + swatchButtons(p, false) + "</div>" : "") +
        '<div class="tile__foot">' + buyButton(p) + policyLine(p) + "</div>" +
      "</div></article>";
  }

  function drawTiles(grid, list) {
    tileProducts = {};
    grid.innerHTML = list.map(tileHTML).join("");
    bindViewers(grid, tileProducts);
  }

  function renderShop() {
    var drop = currentDrop();
    var nameEl = $("#drop-name");
    if (nameEl) nameEl.textContent = drop && drop.name ? drop.name : "Next collection";

    var shipsEl = $("#drop-ships");
    if (shipsEl) {
      var dt = deliveryText(drop);
      shipsEl.textContent = dt || "";
      shipsEl.hidden = !dt;
    }

    startCountdown(drop);

    var grid = $("#product-grid");
    if (grid) {
      var list = visibleProducts(drop ? drop.id : null);
      if (list.length) drawTiles(grid, list);
      else grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' + q("open") + "<p>Nothing here yet.</p>" + q("close") + "</div>";
    }
    var title = $("#shop-title");
    if (title && drop && drop.name) title.textContent = drop.name;

    renderShippingLines($("#ship-lines"), null);
  }

  function startCountdown(drop) {
    var box = $("#countdown");
    if (!box) return;
    // switched off in data/shop.js with showCountdown: false
    if (D.showCountdown === false) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    var ds = dropState(drop);

    if (ds.state === "tba" || ds.state === "none") {
      box.innerHTML = '<div class="countdown__label mono">Pre-order window</div><div class="countdown__tba">Dates TBA</div>';
      return;
    }
    if (ds.state === "closed") {
      box.innerHTML = '<div class="countdown__label mono">Pre-orders</div><div class="countdown__tba">Closed ' + esc(fmtDateTime(ds.close)) + "</div>";
      return;
    }
    if (ds.state === "open" && !ds.close) {
      box.innerHTML = '<div class="countdown__label mono">Pre-orders are</div><div class="countdown__tba">Open now</div>';
      return;
    }

    var label = ds.state === "upcoming" ? "Pre-orders open in" : "Pre-orders close in";
    var when = ds.state === "upcoming" ? ds.open : ds.close;
    box.innerHTML = '<div class="countdown__label mono">' + label + "</div>" +
      '<div class="countdown__grid" role="timer" aria-live="off">' +
        ["Days", "Hrs", "Min", "Sec"].map(function (u) {
          return '<div class="countdown__cell"><span class="countdown__num">00</span><span class="countdown__unit">' + u + "</span></div>";
        }).join("") +
      "</div>" +
      '<div class="hero__ships mono">' + esc(fmtDateTime(when)) + "</div>";

    var nums = box.querySelectorAll(".countdown__num");
    var last = [];
    function tick() {
      var left = Math.max(0, when.getTime() - Date.now());
      if (left === 0) { startCountdown(drop); renderShopTilesOnly(); return; }
      var s = Math.floor(left / 1000);
      var vals = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
      vals.forEach(function (v, i) {
        var t = (v < 10 ? "0" : "") + v;
        if (last[i] !== t) {
          nums[i].textContent = t;
          if (!reduceMotion && last[i] !== undefined) {
            nums[i].classList.remove("tick"); void nums[i].offsetWidth; nums[i].classList.add("tick");
          }
          last[i] = t;
        }
      });
      setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
    }
    tick();
  }
  function renderShopTilesOnly() {
    var grid = $("#product-grid"), drop = currentDrop();
    if (grid) {
      var list = visibleProducts(drop ? drop.id : null);
      if (list.length) { drawTiles(grid, list); observe(); }
    }
  }

  /* ---------------- price lines ---------------- */

  function renderShippingLines(el, p) {
    if (!el) return;
    var rows = [];
    var sp = shipping.price, ip = shipping.inspectionPrice;
    if (p) rows.push(["<span>" + esc(p.name) + '<span class="sub">Size and colour picked at checkout</span></span>', money(p.price) || "TBA"]);
    rows.push([esc(shipping.name || "Canada Post Shipping") + '<span class="sub">Required. Ships Sealed, as it comes from the producer, unless you add the inspection below.</span>', money(sp) || "TBA"]);
    rows.push([esc(shipping.inspectionName || "Checkpoint Inspection") + ' <span class="opt mono">Optional</span><span class="sub">Add it at checkout. We check your piece before it ships.</span>', ip ? "+" + money(ip) : "TBA"]);
    var html = "<table class=\"lines\"><tbody>" + rows.map(function (r) {
      return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>";
    }).join("");
    var base = p ? (isNum(p.price) && isNum(sp) ? p.price + sp : null) : (isNum(sp) ? sp : null);
    var lbl = p ? "Total (CAD)" : "Shipping, per item";
    html += '<tr class="total"><td>' + lbl + ', with inspection</td><td>' + esc(isNum(base) && isNum(ip) ? money(base + ip) : "TBA") + "</td></tr>";
    html += '<tr class="total total--alt"><td>' + lbl + ', Sealed</td><td>' + esc(isNum(base) ? money(base) : "TBA") + "</td></tr>";
    html += "</tbody></table>";
    if (D.taxNote) html += '<p class="fine" style="margin-top:8px">' + esc(D.taxNote) + "</p>";
    el.innerHTML = html;
  }

  /* ---------------- size charts ---------------- */

  var unit = "in";
  try { unit = localStorage.getItem("mayhem-unit") || "in"; } catch (e) { unit = "in"; }

  function chartHTML(chart) {
    if (!chart || typeof chart !== "object") return '<p class="vary">Size chart coming soon.</p>';
    var cols = ["Length", "Shoulder", "Chest", "Sleeve"];
    var sizes = Object.keys(chart);
    var body = sizes.map(function (s) {
      var r = chart[s] || [];
      return "<tr><th scope=\"row\">" + esc(s) + "</th>" + cols.map(function (_, i) {
        var inch = r[i * 2], cm = r[i * 2 + 1];
        var v = unit === "cm" ? (isNum(cm) ? cm : "") : (isNum(inch) ? inch.toFixed(2) : "");
        return "<td>" + esc(v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="chart-wrap"><table class="chart"><thead><tr><th scope="col">Size</th>' +
      cols.map(function (c, i) { return '<th scope="col">' + (i + 1) + " " + c + "</th>"; }).join("") +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function measureHTML() {
    return '<ul class="measure">' +
      '<li><span class="n">1</span><b>Length</b> Shoulder seam at the collar, down to the hem.</li>' +
      '<li><span class="n">2</span><b>Shoulder</b> Sleeve seam to sleeve seam.</li>' +
      '<li><span class="n">3</span><b>Chest</b> Stitch below one armpit to the other.</li>' +
      '<li><span class="n">4</span><b>Sleeve</b> Shoulder seam at the armhole, to the cuff.</li>' +
      "</ul>" +
      '<p class="vary">Actual measurements may vary by 1 to 3 cm (0.4 to 1.2 in).</p>';
  }

  function toggleHTML() {
    return '<div class="unit-toggle" role="group" aria-label="Units">' +
      '<button type="button" data-unit="in" aria-pressed="' + (unit === "in") + '">Inches</button>' +
      '<button type="button" data-unit="cm" aria-pressed="' + (unit === "cm") + '">cm</button></div>';
  }

  function bindToggles(rerender) {
    Array.prototype.forEach.call(document.querySelectorAll(".unit-toggle button"), function (b) {
      b.addEventListener("click", function () {
        unit = b.getAttribute("data-unit");
        try { localStorage.setItem("mayhem-unit", unit); } catch (e) { /* fine */ }
        rerender();
      });
    });
  }

  function renderSizeGuide() {
    var el = $("#guides");
    if (!el) return;
    // one guide per product type that's on the site
    var seen = {}, types = [];
    visibleProducts(null).forEach(function (p) { if (p.type && !seen[p.type] && presets[p.type]) { seen[p.type] = 1; types.push(p.type); } });
    if (!types.length) types = Object.keys(presets);
    function draw() {
      el.innerHTML = types.length ? types.map(function (t) {
        var pre = presets[t];
        return '<section class="guide reveal in" id="' + esc(t) + '">' +
          "<h2>" + esc(pre.label || t) + "</h2>" +
          '<p class="vary" style="margin:0 0 14px">Measured flat, in ' + (unit === "cm" ? "centimetres" : "inches") + ".</p>" +
          toggleHTML() + chartHTML(pre.sizeChart) + measureHTML() +
          (pre.sizeGuideImage ? '<details><summary>See the diagram</summary><img src="' + esc(pre.sizeGuideImage) + '" alt="' + esc((pre.label || t) + " size guide diagram") + '" loading="lazy" width="960" height="1200"></details>' : "") +
          "</section>";
      }).join("") : '<div class="empty">' + q("open") + "<p>Size guides coming soon.</p>" + q("close") + "</div>";
      bindToggles(draw);
    }
    draw();
  }

  /* ---------------- product page ---------------- */

  /* ---------------- full-screen zoom ----------------
     Tap the product image to open it big. Click or tap to zoom in at that
     spot, move or drag to look around, scroll or pinch for finer zoom.
     The Front/Back button (or the arrow keys) flips it without losing the zoom. */

  var ZOOM_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function bindZoom(root, p) {
    var media = root.querySelector(".product__media");
    if (!media || !p.colours.length || !p.colours[0].image) return;
    var card = media.querySelector(".viewer__card");
    if (!card) return;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "viewer__zoom";
    btn.setAttribute("aria-label", "Zoom in on " + p.name);
    btn.innerHTML = ZOOM_ICON + '<span>Zoom</span>';
    media.appendChild(btn);
    function open(e) { if (e) e.preventDefault(); openZoom(p, media, btn); }
    card.addEventListener("click", open);
    btn.addEventListener("click", open);
  }

  function openZoom(p, media, opener) {
    var view = p._view || (p._view = { colour: 0, back: false });
    var c = p.colours[view.colour] || p.colours[0];
    var hasBack = !!c.back;
    var back = hasBack && view.back;
    function src(side) { return side ? (c.zoomBack || c.back) : (c.zoom || c.image); }

    var box = document.createElement("div");
    box.className = "zoom";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", p.name + ", zoomed in");
    box.innerHTML =
      '<button type="button" class="zoom__close" aria-label="Close">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
      '<div class="zoom__stage"><img class="zoom__img" alt="" draggable="false"></div>' +
      '<div class="zoom__bar">' +
        '<p class="zoom__name">' + esc(p.name) + '<span class="mono zoom__side"></span></p>' +
        (hasBack ? '<button type="button" class="zoom__flip" aria-pressed="false">' + FLIP_ICON + '<span class="zoom__flip-label">Back</span></button>' : "") +
        '<p class="zoom__hint mono"></p>' +
      "</div>";
    document.body.appendChild(box);
    var stage = box.querySelector(".zoom__stage"), img = box.querySelector(".zoom__img");
    var flip = box.querySelector(".zoom__flip"), flipLabel = box.querySelector(".zoom__flip-label");
    var side = box.querySelector(".zoom__side"), hint = box.querySelector(".zoom__hint");
    var closeBtn = box.querySelector(".zoom__close");
    var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;

    var scale = 1, tx = 0, ty = 0, MAXS = 4, STEP = 2.5;
    function limits() {
      var r = img.getBoundingClientRect(), w = r.width / scale, h = r.height / scale;
      return { x: Math.max(0, (w * scale - w) / 2), y: Math.max(0, (h * scale - h) / 2), w: w, h: h };
    }
    function clamp() {
      var L = limits();
      tx = Math.max(-L.x, Math.min(L.x, tx)); ty = Math.max(-L.y, Math.min(L.y, ty));
    }
    function apply() {
      if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
      clamp();
      img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
      box.classList.toggle("is-zoomed", scale > 1);
      hint.textContent = scale > 1
        ? (fine ? "Move to look around. Click to zoom out." : "Drag to look around. Tap to zoom out.")
        : (fine ? "Click anywhere to zoom in. Scroll to zoom." : "Tap to zoom in. Pinch to zoom.");
    }
    // zoom to `to`, keeping the point (cx, cy) on screen where it is
    function zoomAt(to, cx, cy) {
      var r = stage.getBoundingClientRect();
      var ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
      to = Math.max(1, Math.min(MAXS, to));
      tx = ox - (ox - tx) * (to / scale); ty = oy - (oy - ty) * (to / scale);
      scale = to; apply();
    }
    function showSide(first) {
      img.src = src(back);
      img.alt = p.name + " in " + c.name + ", " + (back ? "back" : "front");
      side.textContent = back ? "Back" : "Front";
      if (flip) {
        flip.setAttribute("aria-pressed", String(back));
        flip.setAttribute("aria-label", back ? "Show the front" : "Show the back");
        flipLabel.textContent = back ? "Front" : "Back";
      }
      if (!first && !reduceMotion) { img.classList.remove("is-flipping"); void img.offsetWidth; img.classList.add("is-flipping"); }
    }
    function doFlip() { if (!hasBack) return; back = !back; showSide(false); }
    showSide(true); apply();
    // warm the other side so the flip is instant
    if (hasBack) new Image().src = src(!back);

    // pointer handling: tap = toggle zoom, drag = pan, two fingers = pinch
    var pts = {}, start = null, moved = false, pinch = null;
    stage.addEventListener("pointerdown", function (e) {
      if (e.target !== img) return;
      img.setPointerCapture && img.setPointerCapture(e.pointerId);
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        moved = true;
      } else {
        start = { x: e.clientX, y: e.clientY, tx: tx, ty: ty }; moved = false;
      }
      box.classList.add("is-panning");
    });
    stage.addEventListener("pointermove", function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (pinch && ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(pinch.s * d / pinch.d, pinch.cx, pinch.cy); return;
      }
      if (start && ids.length === 1) {
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        if (moved && scale > 1) { tx = start.tx + dx; ty = start.ty + dy; apply(); }
        return;
      }
      // mouse with no button held: the image follows the cursor while zoomed
      if (fine && scale > 1 && e.pointerType === "mouse" && !ids.length) {
        var r = stage.getBoundingClientRect(), L = limits();
        var fx = (e.clientX - r.left) / r.width - 0.5, fy = (e.clientY - r.top) / r.height - 0.5;
        tx = -fx * 2 * L.x; ty = -fy * 2 * L.y; apply();
      }
    });
    function up(e) {
      var wasTap = start && !moved && Object.keys(pts).length === 1;
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
      if (!Object.keys(pts).length) box.classList.remove("is-panning");
      if (wasTap && e.type === "pointerup") {
        if (scale > 1) { scale = 1; apply(); } else zoomAt(STEP, e.clientX, e.clientY);
      }
      if (!Object.keys(pts).length) start = null;
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(scale * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
    }, { passive: false });
    // tap on the dark area (not the image) closes
    stage.addEventListener("click", function (e) { if (e.target === stage) close(); });
    window.addEventListener("resize", apply);

    if (flip) flip.addEventListener("click", doFlip);
    closeBtn.addEventListener("click", close);
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); doFlip(); }
      else if (e.key === "Tab") {   // keep focus inside the zoom view
        var f = [closeBtn, flip].filter(Boolean), i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    }
    document.addEventListener("keydown", onKey);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { box.classList.add("is-open"); closeBtn.focus(); });

    function close() {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", apply);
      document.documentElement.style.overflow = prevOverflow;
      // the product image shows whichever side you left the zoom on
      var pageFlip = media.querySelector(".viewer__flip");
      if (pageFlip && !!view.back !== back) pageFlip.click();
      box.remove();
      if (opener) opener.focus();
    }
  }

  function renderProduct() {
    var el = $("#product");
    if (!el) return;
    var id = null;
    try { id = new URLSearchParams(location.search).get("p"); } catch (e) { id = null; }
    var p = id ? findProduct(id) : null;

    if (!p) {
      el.innerHTML = '<div class="wrap" style="padding:64px var(--gutter)"><div class="empty">' + q("open") +
        '<p>That one isn\'t here. <a href="index.html">Back to the shop</a></p>' + q("close") + "</div></div>";
      return;
    }

    document.title = p.name + ' | Mayhem "Loves You"';
    var drop = dropById(pDrop(p));

    var colours = p.colours.length
      ? '<div class="swatches swatches--list" role="group" aria-label="View colour">' + swatchButtons(p, true) + "</div>" +
        '<p class="fine swatches__note">Tap a colour to see it. You pick yours at checkout.</p>'
      : "";

    var specs = p.details.map(function (r) { return "<tr><th scope=\"row\">" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("");
    var sizes = p.sizeChart ? Object.keys(p.sizeChart).join(", ") : null;
    if (sizes) specs += '<tr><th scope="row">Sizes</th><td>' + esc(sizes) + "</td></tr>";

    function draw() {
      el.innerHTML = '<div class="wrap"><div class="product__layout" data-viewer="p">' +
        '<div class="product__media viewer">' + viewerStage(p, null, (p._view && p._view.colour) || 0) + "</div>" +
        '<div class="product__info">' +
          '<p class="crumbs mono"><a href="index.html">Shop</a> / ' + esc(drop && drop.name ? drop.name : (presets[p.type] && presets[p.type].label) || "") + "</p>" +
          '<h1 class="product__title">' + esc(p.name) + "</h1>" +
          '<p class="product__price">' + esc(priceText(p)) + "</p>" +
          (availText(p) ? '<p class="product__avail mono">' + esc(availText(p)) + "</p>" : "") +
          colours +

          '<div class="buybox">' +
            '<p class="buybox__note">Pick your size and colour on the checkout page. One item per order.</p>' +
            '<div id="buy-lines"></div>' +
            buyButton(p, "btn--pink") +
            '<p class="fine">Canada only.</p>' +
            policyLine(p) +
            payHTML() +
          "</div>" +

          (specs ? '<div class="block"><h2>Details</h2><table class="specs"><tbody>' + specs + "</tbody></table></div>" : "") +
          (p.care ? '<div class="block"><h2>Care</h2><p style="margin:0">' + esc(p.care) + "</p></div>" : "") +
          '<div class="block"><h2>Size guide</h2>' + toggleHTML() + chartHTML(p.sizeChart) + measureHTML() + "</div>" +
        "</div>" +
      "</div></div>";
      renderShippingLines($("#buy-lines"), p);
      bindViewers(el, { p: p });
      bindZoom(el, p);
      bindToggles(draw);
    }
    draw();
  }

  /* ---------------- policy page ---------------- */

  function renderPolicy() {
    renderShippingLines($("#policy-ship"), null);
    var s = $("#policy-delivery");
    if (s) {
      var dt = deliveryText(currentDrop());
      s.textContent = dt || "";
      s.hidden = !dt;
    }
    var pb = $(".print-btn");
    if (pb) pb.addEventListener("click", function () { window.print(); });
  }

  /* ---------------- motion ---------------- */

  var io = null;
  function observe() {
    var els = document.querySelectorAll(".reveal:not(.in), .heading:not(.in), .tile:not(.in)");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(els, function (e) { e.classList.add("in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    }
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  }

  // hero quotes fly apart as you scroll
  function scrollFx() {
    var hero = $(".hero"), cp = $(".checkpoint");
    if (reduceMotion || (!hero && !cp)) return;
    var ticking = false;
    function upd() {
      ticking = false;
      var vh = window.innerHeight || 800;
      if (hero) {
        var r = hero.getBoundingClientRect();
        var s = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
        hero.style.setProperty("--s", s.toFixed(3));
      }
      if (cp) {
        var c = cp.getBoundingClientRect();
        var t = Math.min(1, Math.max(0, (vh - c.top) / (vh + c.height)));
        cp.style.setProperty("--s", t.toFixed(3));
      }
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  // the quotes slam shut then fly open, once per visit
  function intro() {
    var el = $(".intro");
    if (!el) return;
    var seen = false;
    try { seen = sessionStorage.getItem("mayhem-intro") === "1"; sessionStorage.setItem("mayhem-intro", "1"); } catch (e) { seen = false; }
    if (seen || reduceMotion) { el.parentNode.removeChild(el); return; }
    document.documentElement.classList.add("has-intro");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1800);
  }

  // the ticker repeats its phrase until it's wider than the screen,
  // then shows that twice so the loop never runs out
  function fillTicker() {
    var track = $(".ticker__track");
    if (!track) return;
    var item = track.querySelector(".ticker__item");
    if (!item) return;
    var base = item.outerHTML;
    function build() {
      track.innerHTML = base;
      var one = track.firstElementChild.getBoundingClientRect().width || 600;
      var need = Math.ceil((window.innerWidth + 200) / one);
      var half = "";
      for (var i = 0; i < Math.max(1, need); i++) half += base;
      track.innerHTML = half + half;
      // same speed on every screen: about 60px a second
      track.style.animationDuration = Math.max(10, (one * Math.max(1, need)) / 60) + "s";
    }
    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    var lastW = window.innerWidth, t = null;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(t); t = setTimeout(build, 200);
    });
  }

  // the quotes slam shut over the page, then it's off to Stripe
  function checkoutExit() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-checkout]");
      if (!a || !validLink(a.getAttribute("href"))) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduceMotion) return;
      e.preventDefault();
      var href = a.getAttribute("href");
      var ov = document.createElement("div");
      ov.className = "exit";
      ov.setAttribute("aria-hidden", "true");
      ov.innerHTML = q("open") + '<span class="exit__label">Taking you to checkout</span>' + q("close");
      document.body.appendChild(ov);
      setTimeout(function () { window.location.href = href; }, 1050);
    });
    // coming back with the browser's back button: clear the overlay
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      Array.prototype.forEach.call(document.querySelectorAll(".exit"), function (n) { n.parentNode.removeChild(n); });
    });
  }

  /* ---------------- go ---------------- */

  intro();
  renderChrome();
  renderBar();
  try {
    if (page === "shop") renderShop();
    if (page === "product") renderProduct();
    if (page === "sizes") renderSizeGuide();
    if (page === "policy") renderPolicy();
  } catch (err) {
    if (window.console) console.error("Mayhem: something in data/shop.js didn't load right.", err);
  }
  fillTicker();
  checkoutExit();
  observe();
  scrollFx();
})();
