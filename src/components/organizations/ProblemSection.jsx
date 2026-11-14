/**
 * Organizations "Problem" section — the scripted payment-tracing story.
 *
 * One ₦25,000 dues payment is followed from Friday to Sunday across five
 * surfaces (group chat, bank SMS, manual reconciliation, a spreadsheet, and
 * the member asking where the money went) to make the cost of having no
 * record of funds concrete.
 *
 * The timeline is imperative on purpose: it types messages, walks a
 * spreadsheet cell by cell and counts the difference at the end, which is
 * not expressible as declarative state without a lot of ceremony. It drives
 * the DOM through a small set of `data-role` hooks scoped to this component's
 * root, so it can't collide with the member problem section or anything else
 * on the page.
 *
 * Styling is Tailwind-only. `CLS` below maps the short class names used by
 * the timeline markup to their utilities — declared as literal strings in this
 * file, which is also how Tailwind's scanner sees them.
 */

import { useEffect, useRef } from "react";
import { cldUrl } from "../../lib/cloudinary";

/* The five beats of the story, in order. */
const STEPS = [
  ["Fri · 6:10 PM", "Group chat", "Claims with screenshots nobody can verify."],
  ["Fri · 7:08 PM", "Bank alerts", "They name a sender, never a member or a due."],
  ["Sat · 10:05 AM", "Reconciling by hand", "Alerts, notes and screenshots compared one by one."],
  ["Sun · 8:30 PM", "Spreadsheet", "Typed in late. The totals still don't match the bank."],
  ["Sat · 11:42 PM", "A member asks", "Where is the money going? No statement to check."],
];

/**
 * Class map for the markup the timeline injects. Keys are the semantic role;
 * values are the utilities. Kept as one table so the design's values live in
 * a single place instead of being scattered through string concatenation.
 */
const CLS = {
  /* Chat bubbles */
  day: "self-center rounded-[7px] bg-white px-2.5 py-[3px] text-[10.5px] text-[#54656f] shadow-[0_1px_1px_#0001] mb-[3px]",
  wb: "relative max-w-[86%] rounded-[2px] px-2 pt-[5px] pb-[3px] text-[13px] leading-[1.28] text-[#111b21] shadow-[0_1px_0.5px_#0002] animate-[var(--animate-gps-pop)]",
  wbIn: "self-start bg-white rounded-tl-none before:absolute before:-left-1.5 before:top-0 before:border-[6px] before:border-transparent before:border-t-white before:border-r-white before:content-['']",
  wbOut:
    "self-end bg-[#d9fdd3] rounded-tr-none before:absolute before:-right-1.5 before:top-0 before:border-[6px] before:border-transparent before:border-t-[#d9fdd3] before:border-l-[#d9fdd3] before:content-['']",
  wbSender: "block text-[12px] font-semibold no-underline",
  wbTime: "float-right mt-1.5 ml-2 text-[9.5px] text-[#667781] no-underline",
  wbTicks: "ml-0.5 text-[#53bdeb] not-italic",
  wbImg: "w-[206px] px-[3px] pb-[3px] pt-[3px]",
  wbImgCaption: "pt-1 px-1.5 pb-0 text-[13px]",

  /* Payment-confirmation screenshot inside the chat */
  shot: "relative h-[262px] overflow-hidden rounded-md bg-[#111]",
  si: "w-[380px] origin-top-left [transform:scale(0.526)] px-4 pt-[18px] pb-4 text-[15px] leading-[1.3] text-white [font-family:'Helvetica_Neue',Arial,sans-serif]",
  receipt: "rounded-[14px] bg-[#1c1c1e] px-4 pt-[18px] pb-1.5 text-center",
  receiptAvatar:
    "mx-auto mb-2.5 block size-[58px] rounded-full bg-[#7c4dff] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cpath%20fill=%27%23f3d6ff%27%20d=%27M12%2012a4%204%200%20100-8%204%204%200%200%208zm0%202c-3%200-8%201.5-8%204v2h16v-2c0-2.5-5-4-8-4z%27/%3E%3C/svg%3E')] bg-contain bg-center bg-no-repeat",
  receiptTo: "text-[16px] text-[#f2f2f2]",
  receiptAmount: "my-1.5 mt-1.5 text-[38px] font-bold tracking-[-0.5px]",
  receiptOk: "inline-flex items-center gap-[7px] text-[15px] text-[#ddd]",
  receiptTick:
    "grid size-5 place-items-center rounded-full bg-[#2bc48a] text-[12px] font-bold text-[#0b0b0b] not-italic [font-family:sans-serif]",
  receiptCard:
    "mx-4 mt-2.5 mb-2.5 rounded-[14px] border border-[#17362f] bg-[#0f1f1b] px-3 pt-3 pb-3.5",
  receiptGreen: "flex items-center text-[15px] text-[#2bc48a]",
  receiptHelp:
    "m-auto grid size-6 place-items-center rounded-full border-2 border-[#aaa] text-[14px] text-[#aaa] not-italic",
  receiptTrail: "mt-3.5 flex items-start",
  receiptStep: "flex w-[92px] flex-none flex-col items-center gap-[7px] text-[13px] text-[#eee]",
  // The step's own content has to be a centred column: as a plain block the
  // <small> timestamps fall back to inline flow and collide with the label
  // above them and the neighbouring column.
  receiptStepBody: "flex flex-col items-center gap-[7px]",
  receiptLine: "mt-2.5 h-0.5 flex-1 bg-[#2bc48a]",
  receiptStepTime: "text-[10.5px] text-[#9a9a9a]",
  receiptRow: "flex justify-between px-0.5 py-2.5 text-[15px] text-[#a8a8a8]",
  receiptRowValue: "font-medium text-[#f2f2f2]",
  receiptParty: "mt-3 flex justify-between px-4 py-4 text-[15px] text-[#a8a8a8]",
  receiptPartyValue: "text-right text-[#f2f2f2]",
  receiptPartySub: "block text-[13px] text-[#a8a8a8]",

  /* SMS bubbles */
  smsDay: "self-center text-[11px] text-[#5f6368]",
  sms: "max-w-[90%] self-start rounded-[2px] bg-[#f1f3f4] px-3.5 py-2.5 text-[13px] leading-[1.4] animate-[var(--animate-gps-pop)]",
  smsMeta: "mt-1 block text-[10.5px] text-[#5f6368]",

  /* Spreadsheet */
  cellHead:
    "h-[21px] border border-[#dcdcdc] bg-[#efefef] px-1.5 text-center text-[11.5px] leading-[1.5] font-normal text-[#555]",
  cellRowHead:
    "h-[21px] w-[30px] border border-[#dcdcdc] bg-[#efefef] px-1.5 text-center text-[11.5px] leading-[1.5] font-normal text-[#555]",
  cell: "h-[21px] border border-[#dcdcdc] px-1.5 text-[12px] leading-[1.5] whitespace-nowrap overflow-hidden relative",
  // Full class rather than a border-colour override on `cell`: two competing
  // `border-*` utilities on one element are resolved by stylesheet order, not
  // by the order they appear in the class attribute.
  cellData:
    "h-[21px] border border-[#222] px-1.5 text-[12px] leading-[1.5] whitespace-nowrap overflow-hidden relative",
  cellMoney: "text-right",
  cellTotals:
    "h-[21px] border border-[#222] bg-[#d9e8dc] px-1.5 text-[12px] leading-[1.5] text-center font-bold",
  cellBold: "font-bold",
  cellSelected: "relative z-2 outline-2 -outline-offset-2 outline-[#217346]",
  cellBad: "bg-[#fde2e0] font-bold text-[#b3261e]",
};

/** Build a chat bubble. `senders` set colours a member's name. */
function bubble(cls, sender, senderColor, text, time, ticks, img) {
  const parts = [`<div class="${cls}">`];
  if (sender) {
    parts.push(
      `<u class="${CLS.wbSender}"${senderColor ? ` style="color:${senderColor}"` : ""}>${sender}</u>`,
    );
  }
  if (img) parts.push(img);
  parts.push(text);
  if (time) parts.push(`<s class="${CLS.wbTime}">${time}${ticks ? "<i>✓✓</i>" : ""}</s>`);
  parts.push("</div>");
  return parts.join("");
}

/**
 * The payment-confirmation screenshot shown inside the group chat — a
 * standalone SVG so it stays crisp at the phone's small size.
 */
const RECEIPT_SCREENSHOT = `
<div class="${CLS.shot}">
  <div class="${CLS.si}">
    <div class="${CLS.receipt}">
      <span class="${CLS.receiptAvatar}"></span>
      <div class="${CLS.receiptTo}">To IKEJA TRADERS CLUB</div>
      <div class="${CLS.receiptAmount}">₦25,000.00</div>
      <div class="${CLS.receiptOk}"><i class="${CLS.receiptTick}">✓</i>Successful</div>
      <div class="${CLS.receiptCard}">
        <div class="${CLS.receiptGreen}">
          <span>✓Credited in seconds</span><em class="${CLS.receiptHelp}">?</em>
        </div>
        <div class="${CLS.receiptTrail}">
          <div class="${CLS.receiptStep}">
            <div class="${CLS.receiptStepBody}">
              ✓<br>Payment<br>Submitted<small class="${CLS.receiptStepTime}">09-25 6:09:41 PM</small>
            </div>
          </div>
          <span class="${CLS.receiptLine}"></span>
          <div class="${CLS.receiptStep}">
            <div class="${CLS.receiptStepBody}">
              ✓<br>Debit<br>Successful<small class="${CLS.receiptStepTime}">09-25 6:09:42 PM</small>
            </div>
          </div>
          <span class="${CLS.receiptLine}"></span>
          <div class="${CLS.receiptStep}">
            <div class="${CLS.receiptStepBody}">
              ✓<br>Money<br>Credited<small class="${CLS.receiptStepTime}">09-25 6:09:42 PM</small>
            </div>
          </div>
        </div>
        <div class="${CLS.receiptRow}">Transfer Amount<b class="${CLS.receiptRowValue}">₦25,000.00</b></div>
        <div class="${CLS.receiptRow}">Fee<b class="${CLS.receiptRowValue}">₦0.00</b></div>
        <div class="${CLS.receiptRow}">Payment Amount<b class="${CLS.receiptRowValue}">₦25,000.00</b></div>
      </div>
      <div class="${CLS.receiptParty}">
        Recipient<div class="${CLS.receiptPartyValue}">IKEJA TRADERS CLUB<small class="${CLS.receiptPartySub}">CityBank | 0123456789</small></div>
      </div>
    </div>
  </div>
</div>`;

export default function ProblemSection() {
  const rootRef = useRef(null);
  const restartRef = useRef(() => {});

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    /* Every lookup is scoped to this section so the timeline can never grab
       (or be confused by) an element with the same role elsewhere. */
    const $ = (role) => root.querySelector(`[data-role="${role}"]`);
    const $$ = (role) => [...root.querySelectorAll(`[data-role="${role}"]`)];

    let R = 0;
    let observer;
    let current = null;

    /* Who paid what, by spreadsheet row: [Jan, Feb, Mar]. */
    const ROWS = [
      ["Okafor C.", 25, 25, 0],
      ["Eze N.", 25, 10, 25],
      ["Bello T.", 25, 25, 0],
      ["Adeyemi K.", 0, 25, 25],
      ["Nwosu E.", 20, 25, 25],
    ];
    const COLS = "ABCDEFG";

    /* Build the grid once: a header row plus 13 numbered rows. Injected into
       the <table data-role="grid">, so the tags survive and lay out as a real
       spreadsheet grid. Cells carry `data-role` (not `id`) because that is
       what `$` resolves — `cell("A5")` looks up `[data-role="A5"]`. */
    function buildGrid() {
      const head = [`<tr><th class="${CLS.cellRowHead}"></th>`]
        .concat(COLS.split("").map((c) => `<th class="${CLS.cellHead}">${c}</th>`))
        .join("")
        .concat("</tr>");
      let html = head;
      for (let r = 1; r <= 13; r++) {
        html += `<tr><th class="${CLS.cellRowHead}">${r}</th>`;
        for (let c = 0; c < 7; c++) {
          // Rows 4-10 carry the data block (the "headline" row is row 4).
          let cls = r >= 4 && r <= 10 && c < 6 ? CLS.cellData : CLS.cell;
          if (r === 4 && c < 6) cls = CLS.cellTotals;
          // Money columns are right-aligned, except in the centred headline row.
          else if (c > 1) cls += " " + CLS.cellMoney;
          html += `<td data-role="${COLS[c]}${r}" class="${cls}"></td>`;
        }
        html += "</tr>";
      }
      $("grid").innerHTML = html;
      $("grid").insertAdjacentHTML(
        "afterbegin",
        '<colgroup><col style="width:30px"><col style="width:34px"><col style="width:120px"><col span=3 style="width:78px"><col style="width:96px"><col></colgroup>',
      );
    }

    /** Add or remove a CLS entry. classList takes ONE token at a time and
        throws on a string with spaces, so the utility strings in CLS have to
        be handed over a class at a time. */
    function paint(el, cls, on) {
      if (!el || !cls) return;
      for (const c of cls.split(/\s+/)) {
        if (!c) continue;
        if (on) el.classList.add(c);
        else el.classList.remove(c);
      }
    }

    /** Move the selection outline to a cell and optionally fill it. */
    function cell(id, value, formula, cls) {
      if (current) paint(current, CLS.cellSelected, false);
      current = $(id);
      paint(current, CLS.cellSelected, true);
      $("nameBox").textContent = id;
      $("formulaBar").textContent = formula || value || "";
      if (value !== undefined && value !== "") current.textContent = value;
      if (cls) paint(current, cls, true);
    }

    /* The five scenes, each an async beat. `z` waits, and throws if the
       timeline was superseded meanwhile (replay clicked, or unmounted). */
    const SCENES = [
      async function chat(z) {
        const box = $("chat");
        box.innerHTML = `<div class="${CLS.day}">FRIDAY</div>`;
        const push = (side, sender, color, text, time, ticks, img) => {
          const cls = side === "in" ? `${CLS.wb} ${CLS.wbIn}` : `${CLS.wb} ${CLS.wbOut}`;
          box.insertAdjacentHTML("beforeend", bubble(cls, sender, color, text, time, ticks, img));
        };

        await z(900);
        push("in", "Chidi, 4B", "#c0392b", "Dues paid ✅", "6:10 PM", true, RECEIPT_SCREENSHOT);
        await z(1700);
        push("in", "Ngozi", "#1b7f5c", "Sent mine this morning o", "6:14 PM");
        await z(1700);
        push("in", "Tunde", "#a05a00", "I sent 25k. Abeg confirm 🙏", "6:21 PM");
        await z(1500);
        $("typing").textContent = "typing…";
        await z(1700);
        $("typing").textContent = "48 participants";
        push("out", null, null, "Which account? The alert has no names 😩", "6:31 PM");
        await z(2200);
      },

      async function alerts(z) {
        const box = $("sms");
        box.innerHTML = `<div class="${CLS.smsDay}">Today</div>`;
        $("smsNote").classList.remove("show");

        const ALERTS = [
          ["25,000.00", "C OKAFOR/MAR", "6:48 PM", "1,284,512.40"],
          ["25,000.00", "NIP/MOB/0813****/DUES", "6:52 PM", "1,309,512.40"],
          ["20,000.00", "E NWOSU", "7:05 PM", "1,329,512.40"],
        ];
        for (const [amount, desc, time, balance] of ALERTS) {
          await z(1000);
          box.insertAdjacentHTML(
            "beforeend",
            `<div class="${CLS.sms}">Credit Alert!<br>Acc#: ******548<br>Amt: ${amount}<br>Desc: TRF FROM ${desc}<br>Avail Bal: ${balance}<span class="${CLS.smsMeta}">${time} · SIM 1</span></div>`,
          );
        }
        await z(1200);
        $("smsNote").classList.add("show");
        await z(2600);
      },

      async function counting(z) {
        const pic = $("countingPhoto");
        $("countingCaption").classList.remove("show");
        pic.classList.remove("zoom");
        void pic.offsetWidth; // restart the zoom transition
        pic.classList.add("zoom");
        await z(1400);
        $("countingCaption").classList.add("show");
        await z(3400);
      },

      async function spreadsheet(z) {
        buildGrid();
        current = null;

        ["No", "Name", "Jan", "Feb", "Mar", "Total"].forEach((head, k) => {
          $(`${"ABCDEF"[k]}4`).textContent = head;
        });

        await z(700);
        for (let i = 0; i < 5; i++) {
          const row = i + 5;
          const dues = ROWS[i];
          cell(`A${row}`, i + 1);
          await z(130);
          cell(`B${row}`, dues[0]);
          await z(130);
          for (let j = 1; j <= 3; j++) {
            cell(`CDE`[j - 1] + row, dues[j] ? `${dues[j]},000` : "");
            await z(dues[j] ? 150 : 90);
          }
          cell(`F${row}`, `${dues[1] + dues[2] + dues[3]},000`, `=SUM(C${row}:E${row})`);
          await z(170);
        }
        cell("B10", "Total");
        paint($("B10"), CLS.cellBold, true);
        cell("F10", "280,000", "=SUM(F5:F9)", CLS.cellBold);
        await z(500);
        cell("A12", "Bank statement");
        cell("F12", "275,000");
        await z(500);
        cell("A13", "Difference", "=F10-F12");
        paint($("A13"), CLS.cellBad, true);
        // The value belongs here: the port coloured F13 but never wrote to it,
        // so the mismatch the whole scene is about ended on a blank cell.
        cell("F13", "-5,000", "=F10-F12", CLS.cellBad);
        paint($("F13"), CLS.cellBold, true);
        await z(2400);
      },

      async function asking(z) {
        const caption = $("askCaption");
        const line = $("askLine");
        const pic = $("askPhoto");
        // Type into the span, never the caption itself — setting the
        // caption's textContent would delete the <em> wrapper (and with it
        // the large type and the slide-up) before the line is ever typed.
        line.textContent = "";
        caption.classList.remove("show");
        pic.classList.remove("zoom");
        void pic.offsetWidth;
        pic.classList.add("zoom");
        await z(1400);
        caption.classList.add("show");
        await z(500);

        // Type the member's question out.
        const text = "Did mine reflect?";
        for (let i = 1; i <= text.length; i++) {
          line.textContent = text.slice(0, i);
          await z(90);
        }
        await z(2200);
      },
    ];

    /** Run scenes from `index` onward; auto-loops back to the start. */
    async function play(index) {
      const run = ++R;
      const wait = (ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        }).then(() => {
          if (run !== R) throw 0; // superseded — unwind quietly
        });

      const markers = $$("step");
      try {
        $("verdict").classList.remove("on");
        for (let i = index; i < SCENES.length; i++) {
          markers.forEach((m, k) => {
            m.classList.toggle("active", k === i);
            m.classList.toggle("done", k < i);
          });
          $$("scene").forEach((s, k) => s.classList.toggle("on", k === i));
          // Marks the stage so its height can follow the active scene's content
          // on phones (see the [data-role="stage"][data-scene] rules in
          // index.css — the scenes are absolute, so the stage can't size to them).
          $("stage").dataset.scene = String(i);
          await SCENES[i](wait);
          if (i < SCENES.length - 1) await wait(500);
        }
        markers.forEach((m) => m.classList.add("done"));
        $("verdict").classList.add("on");
        await wait(5000);
        play(0);
      } catch {
        /* stopped: replay clicked, a step was jumped to, or unmounted */
      }
    }

    /* The spreadsheet mock is authored at a fixed 724px width and scaled down
       to fit whatever column it lands in. */
    function fit() {
      const stage = $("stage");
      const mock = $("mock");
      if (!stage || !mock) return;
      const scale = Math.min(1, (stage.clientWidth - 20) / 724);
      mock.style.transform = `scale(${scale})`;
    }

    fit();
    window.addEventListener("resize", fit);
    restartRef.current = (index = 0) => play(index);

    let started = false;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries, o) => {
          if (entries[0].isIntersecting && !started) {
            started = true;
            play(0);
            o.disconnect();
          }
        },
        { threshold: 0.3 },
      );
      observer.observe($("player"));
    } else {
      play(0);
    }

    return () => {
      R++; // cancel anything in flight
      if (observer) observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="px-4 py-[88px] text-[17px] leading-[1.55] text-[#6b7280] max-[1040px]:py-14"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* ── Header ── */}
        <header className="grid grid-cols-1 items-start gap-y-6 min-[1041px]:flex min-[1041px]:flex-col min-[1041px]:items-center min-[1041px]:gap-y-0 min-[1041px]:text-center">
          <div className="min-[1041px]:flex min-[1041px]:flex-col min-[1041px]:items-center">
            <div className="inline-flex items-center rounded-full border border-brand-deep/25 px-5 py-2 text-[13px] font-medium text-brand-deep">
              The Problem
            </div>
            <h2 className="mt-[18px] max-w-[20ch] text-[clamp(26px,5vw,58px)] font-bold leading-[1.15] tracking-[-0.02em] text-balance text-brand-ink min-[1041px]:text-center">
              Still spending weekends chasing payments?
            </h2>
          </div>
          <p className="m-0 max-w-[34ch] text-[clamp(15px,2vw,17px)] leading-[1.45] min-[1041px]:mx-auto min-[1041px]:mt-4 min-[1041px]:max-w-[640px] min-[1041px]:text-center">
            Without centralized visibility, time is wasted and trust begins to weaken.
          </p>
        </header>

        {/* ── Story controls ── */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
          <h3 className="m-0 text-[clamp(1.15rem,2vw,1.4rem)] font-semibold tracking-[-0.02em] text-brand-navy">
            One ₦25,000 dues payment, followed from Friday to Sunday
          </h3>
          <div className="flex items-center gap-3.5 text-[12px]">
            <span>Sample data</span>
            <button
              type="button"
              onClick={() => restartRef.current(0)}
              className="cursor-pointer rounded-full border border-[#cdd0e2] bg-none px-3 py-1.5 text-[12px] font-semibold text-[#002fa7]"
            >
              ↻ Replay
            </button>
          </div>
        </div>

        {/* ── Player ── */}
        <div
          data-role="player"
          className="mt-5 grid grid-cols-1 items-stretch gap-8 min-[1041px]:gap-6"
        >
          <ol className="relative m-0 list-none gap-2 overflow-x-auto p-0 max-[1040px]:flex min-[1041px]:grid min-[1041px]:grid-cols-5 min-[1041px]:gap-3">
            {STEPS.map(([when, where, why], i) => (
              <li
                key={when}
                data-role="step"
                onClick={() => restartRef.current(i)}
                className="group relative cursor-pointer pb-[22px] pl-[52px] max-[1040px]:flex max-[1040px]:flex-none max-[1040px]:items-center max-[1040px]:p-0 min-[1041px]:min-h-[160px] min-[1041px]:rounded-g-3 min-[1041px]:border min-[1041px]:border-[#e2e4ee] min-[1041px]:bg-white/80 min-[1041px]:px-3 min-[1041px]:pt-12 min-[1041px]:pb-3 [&::before]:absolute [&::before]:bottom-[2px] [&::before]:left-[15px] [&::before]:top-[34px] [&::before]:border-l-2 [&::before]:border-dashed [&::before]:border-[#cdd0e2] [&::before]:content-[''] max-[1040px]:[&::before]:hidden min-[1041px]:[&::before]:hidden [&:last-child::before]:hidden [.done_&]:[&::before]:border-solid"
              >
                <span className="absolute top-0 left-0 grid size-8 place-items-center rounded-full border-2 border-[#cdd0e2] bg-white text-[13px] font-semibold text-[#6b7280] transition duration-400 group-[.active]:border-[#002fa7] group-[.active]:bg-[#002fa7] group-[.active]:text-white group-[.active]:shadow-[0_0_0_6px_rgba(59,43,184,0.14)] [.done_&]:border-[#002fa7] [.done_&]:text-[#002fa7] max-[1040px]:static max-[1040px]:size-7 min-[1041px]:top-3 min-[1041px]:left-3 [&.done_&>b]:hidden max-[1040px]:[&.done_&>b]:block max-[1040px]:[&.done_&>b]:text-[15px]">
                  <b>{i + 1}</b>
                </span>
                <div className="text-[11.5px] font-semibold tracking-[0.05em] text-[#6b7280] uppercase max-[1040px]:hidden min-[1041px]:absolute min-[1041px]:top-4 min-[1041px]:left-14">
                  {when}
                </div>
                <h4 className="mt-0.5 text-[18px] tracking-[-0.01em] text-[#9a9db3] transition duration-300 group-[.active]:text-brand-navy group-[.done]:text-brand-navy max-[1040px]:hidden max-[1040px]:group-[.active]:block max-[1040px]:group-[.active]:mt-0 max-[1040px]:group-[.active]:ml-2 min-[1041px]:mt-0 min-[1041px]:text-[16px]">
                  {where}
                </h4>
                <p className="mt-0 max-h-0 translate-y-[-8px] overflow-hidden text-[15px] leading-[1.45] transition duration-500 group-[.active]:mt-1 group-[.active]:max-h-20 group-[.active]:translate-y-0 max-[1040px]:hidden">
                  {why}
                </p>
              </li>
            ))}
          </ol>

          <div
            data-role="stage"
            className="relative min-h-[640px] overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#d8d9de,#bfc1c9)] transition-[min-height] duration-500 max-[1040px]:min-h-[620px] max-[600px]:min-h-[620px]"
          >
            {/* Decorative logo marks */}
            <img
              src={cldUrl("glass/problem/logo-mark-lg", { width: 520 })}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-[-30px] top-[-10px] w-[520px] animate-[var(--animate-gps-drift)] max-[600px]:right-0 max-[600px]:w-[210px]"
            />
            <img
              src={cldUrl("glass/problem/logo-mark-sm", { width: 150 })}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[30px] left-0 w-[150px] animate-[var(--animate-gps-drift)] max-[600px]:bottom-[16px] max-[600px]:w-[90px]"
              style={{ animationDelay: "-6s" }}
            />

            {/* ── Scene 1: group chat ── */}
            <div
              data-role="scene"
              className="scene absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 invisible translate-x-10 [clip-path:inset(0_0_0_100%)] transition-[clip-path,transform,visibility] duration-750 [&.on]:visible [&.on]:translate-x-0 [&.on]:[clip-path:inset(0)] [&.on]:delay-0"
            >
              <div className="relative h-[572px] w-[262px] flex-none rounded-[46px] bg-[linear-gradient(145deg,#d9d9dd,#8d8e94_40%,#c9cace_70%,#9a9ba1)] p-[5px] shadow-[0_0_0_1.5px_#6e6f75_inset,0_28px_40px_#00000040,0_6px_12px_#00000026] before:absolute before:-left-[3px] before:top-[118px] before:h-6 before:w-[3px] before:rounded-l-sm before:bg-[#8d8e94] before:shadow-[0_48px_0_#8d8e94,0_98px_0_#8d8e94] before:content-[''] after:absolute after:-right-[3px] after:top-40 after:h-[70px] after:w-[3px] after:rounded-r-sm after:bg-[#8d8e94] after:content-['']">
                <div className="relative flex h-full flex-col overflow-hidden rounded-[41px] border-[3px] border-[#050506] bg-white font-[-apple-system,'SF_Pro_Text',Roboto,'Segoe_UI',system-ui,sans-serif] before:absolute before:top-2 before:left-1/2 before:z-3 before:h-[21px] before:w-18 before:-ml-9 before:rounded-full before:bg-black before:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:z-3 after:h-1 after:w-21 after:-ml-[42px] after:rounded after:bg-black after:content-['']">
                  <div
                    style={{ background: "#008069" }}
                    className="flex h-10 items-center justify-between pt-2 pr-[26px] pl-[26px] text-[11.5px] font-semibold text-white"
                  >
                    <span>6:31</span>
                    <span>▂▄▆ 5G ▮</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#008069] pb-2 pr-2.5 pl-0 text-white">
                    <span>←</span>
                    <span className="size-[34px] flex-none rounded-full bg-[#dfe5e7] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cpath%20fill=%27%23fff%27%20d=%27M12%2012a4%204%200%20100-8%204%204%200%200%208zm0%202c-3%200-8%201.5-8%204v2h16v-2c0-2.5-5-4-8-4z%27/%3E%3C/svg%3E')] bg-[length:80%] bg-center bg-no-repeat" />
                    <div>
                      <b className="block text-[14.5px] font-medium leading-[1.15]">
                        Ikeja Traders Club
                      </b>
                      <small data-role="typing" className="text-[11px] opacity-85">
                        48 participants
                      </small>
                    </div>
                    <i className="ml-auto text-[6px] tracking-[6px] not-italic">⋮</i>
                  </div>

                  <div
                    data-role="chat"
                    className="flex flex-1 flex-col justify-end gap-[5px] overflow-hidden bg-[#efeae2] bg-[radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1.5px)] bg-[size:14px_14px] px-2 pt-2 pb-1.5"
                  />

                  <div className="flex items-center gap-1.5 bg-[#f0f2f5] px-2 pt-1.5 pb-5">
                    <div className="flex flex-1 items-center gap-2 rounded-[2px] bg-white px-3 py-[7px] text-[12.5px] text-[#8696a0]">
                      <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="#8696a0"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8.5 14c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3" />
                        <circle cx="9" cy="10" r=".6" fill="#8696a0" />
                        <circle cx="15" cy="10" r=".6" fill="#8696a0" />
                      </svg>
                      <span className="flex-1">Message</span>
                      <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="#8696a0"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 11.5l-7.6 7.6a5 5 0 01-7-7l8-8a3.3 3.3 0 014.7 4.7l-8 8a1.7 1.7 0 01-2.4-2.4l7.2-7.2" />
                      </svg>
                      <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="#8696a0"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                        <circle cx="12" cy="13" r="3.2" />
                      </svg>
                    </div>
                    <i className="grid size-[34px] flex-none place-items-center rounded-full bg-[#008069]">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
                        <path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V22h2v-3.08A7 7 0 0019 12h-2z" />
                      </svg>
                    </i>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Scene 2: bank SMS ── */}
            <div
              data-role="scene"
              className="scene absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 invisible translate-x-10 [clip-path:inset(0_0_0_100%)] transition-[clip-path,transform,visibility] duration-750 [&.on]:visible [&.on]:translate-x-0 [&.on]:[clip-path:inset(0)] [&.on]:delay-0"
            >
              {/* Phone and its callout sit side by side on desktop — the
                  dashed connector in the note points at the phone, and a
                  572px phone plus a note below it is taller than the 640px
                  stage, which clipped the phone's top. Phones stack them. */}
              <div className="flex items-center justify-center max-[600px]:flex-col max-[600px]:items-center">
                <div className="relative h-[572px] w-[262px] flex-none rounded-[46px] bg-[linear-gradient(145deg,#d9d9dd,#8d8e94_40%,#c9cace_70%,#9a9ba1)] p-[5px] shadow-[0_0_0_1.5px_#6e6f75_inset,0_28px_40px_#00000040,0_6px_12px_#00000026] before:absolute before:-left-[3px] before:top-[118px] before:h-6 before:w-[3px] before:rounded-l-sm before:bg-[#8d8e94] before:shadow-[0_48px_0_#8d8e94,0_98px_0_#8d8e94] before:content-[''] after:absolute after:-right-[3px] after:top-40 after:h-[70px] after:w-[3px] after:rounded-r-sm after:bg-[#8d8e94] after:content-['']">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[41px] border-[3px] border-[#050506] bg-white font-[-apple-system,'SF_Pro_Text',Roboto,'Segoe_UI',system-ui,sans-serif] before:absolute before:top-2 before:left-1/2 before:z-3 before:h-[21px] before:w-18 before:-ml-9 before:rounded-full before:bg-black before:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:z-3 after:h-1 after:w-21 after:-ml-[42px] after:rounded after:bg-black after:content-['']">
                    <div className="flex h-10 items-center justify-between pt-2 pr-[26px] pl-[26px] text-[11.5px] font-semibold text-[#202124]">
                      <span>7:08</span>
                      <span>▂▄▆ 5G ▮</span>
                    </div>
                    <div className="flex items-center gap-2.5 border-b border-[#eee] bg-white pt-0.5 pr-3 pb-2 pl-3 text-[#202124]">
                      <span className="text-[20px]">←</span>
                      <span className="size-8 rounded-full bg-[#a142f4] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cpath%20fill=%27%23fff%27%20d=%27M12%2012a4%204%200%20100-8%204%204%200%200%208zm0%202c-3%200-8%201.5-8%204v2h16v-2c0-2.5-5-4-8-4z%27/%3E%3C/svg%3E')] bg-[length:78%] bg-center bg-no-repeat" />
                      <b className="text-[16px] font-medium">CITYBANK</b>
                      <i className="ml-auto font-bold not-italic">⋮</i>
                    </div>

                    <div
                      data-role="sms"
                      className="flex flex-1 flex-col justify-end gap-3 overflow-hidden bg-white px-3 pt-2 pb-2 text-[#202124]"
                    />

                    <div className="flex gap-2.5 border-t border-[#eee] px-3 pt-2 pb-5 text-[13px] text-[#5f6368]">
                      <div className="flex-1 rounded-[2px] border border-[#dadce0] px-3.5 py-[7px]">
                        Text message
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  data-role="smsNote"
                  className="mt-[120px] flex items-center [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-700 [&.show]:[clip-path:inset(0)] max-[600px]:mt-3 max-[600px]:flex-col max-[600px]:items-center"
                >
                  <i className="w-[46px] flex-none border-t-2 border-dashed border-[#e0ab88] max-[600px]:h-7 max-[600px]:w-auto max-[600px]:border-t-0 max-[600px]:border-l-2" />
                  <span className="max-w-[210px] rounded-lg border-l-4 border-[#e0ab88] bg-white px-4 py-3 text-[15px] leading-[1.35] font-medium text-brand-navy shadow-[0_8px_24px_#0000001a]">
                    Who is C Okafor? Which member? Which due?
                  </span>
                </div>
              </div>
            </div>

            {/* ── Scene 3: counting by hand ── */}
            <div
              data-role="scene"
              className="scene absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 invisible translate-x-10 [clip-path:inset(0_0_0_100%)] transition-[clip-path,transform,visibility] duration-750 [&.on]:visible [&.on]:translate-x-0 [&.on]:[clip-path:inset(0)] [&.on]:delay-0"
            >
              <div
                data-role="countingPhoto"
                className="relative h-[480px] w-[min(100%,680px)] overflow-hidden rounded-[20px] shadow-[0_24px_50px_#00000026] max-[1040px]:h-[380px] max-[600px]:h-[300px]"
              >
                <img
                  src={cldUrl("glass/problem/naira-count", { width: 1000 })}
                  alt="A man in a market counting a thick bundle of worn naira notes by hand"
                  className="block h-full w-full scale-100 object-cover transition-transform duration-[9s] ease-out [transform-origin:60%_40%] [.zoom_&]:scale-110"
                />
                <div
                  data-role="countingCaption"
                  className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(14,14,16,0.94),rgba(14,14,16,0.62)_50%,transparent)] px-7 pt-[90px] pb-[26px] text-white [clip-path:inset(100%_0_0_0)] transition-[clip-path] duration-800 [&.show]:[clip-path:inset(0)]"
                >
                  <small className="flex items-center gap-2.5 text-[11.5px] font-semibold tracking-[0.12em] text-[#b9b9c0] uppercase before:w-[26px] before:border-t-2 before:border-[#e0ab88] before:content-['']">
                    Sat · 10:05 AM
                  </small>
                  <em className="mt-2 block translate-y-[14px] text-[clamp(20px,2.6vw,28px)] leading-[1.2] font-semibold tracking-[-0.02em] not-italic transition-transform delay-250 [&.show]:translate-y-0">
                    Alerts, notes and screenshots, one by one…
                  </em>
                </div>
              </div>
            </div>

            {/* ── Scene 4: the spreadsheet ── */}
            <div
              data-role="scene"
              className="scene absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 invisible translate-x-10 [clip-path:inset(0_0_0_100%)] transition-[clip-path,transform,visibility] duration-750 [&.on]:visible [&.on]:translate-x-0 [&.on]:[clip-path:inset(0)] [&.on]:delay-0"
            >
              <div
                data-role="mock"
                className="w-[724px] flex-none flex flex-col items-center drop-shadow-[0_30px_40px_#02061f99] max-[1040px]:origin-top"
              >
                <div className="relative w-[660px] rounded-[18px_18px_4px_4px] border-2 border-[#d3d5db] bg-[#0a0a0c] px-3 pt-3 pb-3.5 before:absolute before:top-1 before:left-1/2 before:size-1 before:rounded-full before:bg-[#2a2c34] before:content-['']">
                  <div className="h-[398px] overflow-hidden rounded-[3px] bg-white font-['Segoe_UI',Calibri,Helvetica,Arial,sans-serif]">
                    <div className="flex items-center justify-between border-b border-[#d9d9d9] bg-[#f4f4f5] px-2.5 py-1.5 text-[12px] text-[#333]">
                      <span className="flex gap-[7px]">
                        <i className="size-[11px] rounded-full bg-[#ff5f57]" />
                        <i className="size-[11px] rounded-full bg-[#febc2e]" />
                        <i className="size-[11px] rounded-full bg-[#28c840]" />
                      </span>
                      <span className="font-medium">dues_march_FINAL_v3.xlsx</span>
                      <span />
                    </div>
                    <div className="flex gap-4 border-b border-[#d4d4d4] bg-white px-2.5 py-[5px] text-[11.5px] text-[#333]">
                      <b className="border-b-2 border-[#217346] pb-[3px] font-semibold">Home</b>
                      <span>Insert</span>
                      <span>Draw</span>
                      <span>Page Layout</span>
                      <span>Formulas</span>
                      <span>Data</span>
                      <span>Review</span>
                      <span>View</span>
                    </div>
                    <div className="flex border-b border-[#d4d4d4] text-[12px]">
                      <div data-role="nameBox" className="border-r border-[#d4d4d4] px-2 py-1">
                        A1
                      </div>
                      <div
                        data-role="formulaBar"
                        className="min-h-6 flex-1 px-2 py-1 before:text-[#888] before:font-semibold before:not-italic before:content-['fx_']"
                      />
                    </div>
                    <table
                      data-role="grid"
                      className="h-[326px] w-full table-fixed border-collapse border-[#dcdcdc] max-[600px]:h-[300px]"
                    />
                    <div className="flex gap-0.5 border-t border-[#d4d4d4] bg-[#f4f4f5] px-2 py-1 text-[11.5px]">
                      <span className="rounded-b bg-white px-3 py-[3px] font-semibold text-[#217346] shadow-[inset_0_2px_0_#217346]">
                        Sheet1
                      </span>
                      <span className="rounded-b bg-[#e4e4e4] px-3 py-[3px]">Jan</span>
                      <span className="rounded-b bg-[#e4e4e4] px-3 py-[3px]">Feb</span>
                      <span className="rounded-b bg-[#e4e4e4] px-3 py-[3px]">Mar</span>
                    </div>
                  </div>
                </div>
                <div className="relative mt-[-1px] h-[14px] w-[724px] rounded-b-[18px/14px] bg-[linear-gradient(#e9eaee,#b7bac3)] before:absolute before:top-0 before:left-1/2 before:h-[5px] before:w-[110px] before:-ml-[55px] before:rounded-b-lg before:bg-[#9b9ea8] before:content-['']" />
              </div>
            </div>

            {/* ── Scene 5: the member asks ── */}
            <div
              data-role="scene"
              className="scene absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 invisible translate-x-10 [clip-path:inset(0_0_0_100%)] transition-[clip-path,transform,visibility] duration-750 [&.on]:visible [&.on]:translate-x-0 [&.on]:[clip-path:inset(0)] [&.on]:delay-0"
            >
              <div
                data-role="askPhoto"
                className="relative h-[480px] w-[min(100%,680px)] overflow-hidden rounded-[20px] shadow-[0_24px_50px_#00000026] max-[1040px]:h-[380px] max-[600px]:h-[300px]"
              >
                <img
                  src={cldUrl("glass/problem/member-phone", { width: 1000 })}
                  alt="A member looking away from a table while holding his phone"
                  className="block h-full w-full scale-100 object-cover transition-transform duration-[9s] ease-out [transform-origin:60%_40%] [.zoom_&]:scale-110"
                />
                <div
                  data-role="askCaption"
                  className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(14,14,16,0.94),rgba(14,14,16,0.62)_50%,transparent)] px-7 pt-[90px] pb-[26px] text-white [clip-path:inset(100%_0_0_0)] transition-[clip-path] duration-800 [&.show]:[clip-path:inset(0)] [&.show>em]:translate-y-0 after:ml-1 after:inline-block after:h-[0.95em] after:w-[3px] after:translate-y-[1px] after:bg-[#e0ab88] after:align-[2px] after:animate-[var(--animate-gps-blink)] after:content-['']"
                >
                  <small className="flex items-center gap-2.5 text-[11.5px] font-semibold tracking-[0.12em] text-[#b9b9c0] uppercase before:w-[26px] before:border-t-2 before:border-[#e0ab88] before:content-['']">
                    Member · Chidi, 4B
                  </small>
                  <em className="mt-2 block translate-y-[14px] text-[clamp(20px,2.6vw,28px)] leading-[1.2] font-semibold tracking-[-0.02em] not-italic transition-transform delay-250 [&.show>em]:translate-y-0">
                    <span data-role="askLine" />
                  </em>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Verdict ── */}
        <div
          data-role="verdict"
          className="mt-6 rounded-xl border border-[#e2e4ee] bg-white px-7 py-[22px] text-[clamp(1.1rem,2vw,1.4rem)] leading-[1.35] text-brand-navy [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-800 [&.on]:[clip-path:inset(0)]"
        >
          <b className="font-bold">Five places hold one payment.</b>{" "}
          <span className="text-[#6b7280]">None of them is the record.</span>
        </div>

        {/* ── Time / Trust ── */}
        <div className="mt-16 grid grid-cols-2 border-t border-[#e2e4ee] max-[1040px]:mt-12 max-[1040px]:grid-cols-1">
          <div className="py-9 pr-12 pb-2">
            <div className="text-[12px] font-semibold tracking-[0.14em] text-[#002fa7] uppercase">
              Time
            </div>
            <h4 className="mt-3 max-w-[20ch] text-[clamp(1.45rem,2.5vw,1.85rem)] leading-[1.18] font-semibold tracking-[-0.025em] text-balance text-brand-navy">
              How much time is your team losing to manual reconciliation?
            </h4>
            <p className="mt-3.5 max-w-[34ch]">
              Bank alerts and spreadsheets consume hours every month.
            </p>
          </div>
          <div className="border-l border-[#e2e4ee] py-9 pr-0 pb-2 pl-12 max-[1040px]:mt-5 max-[1040px]:border-t max-[1040px]:border-l-0 max-[1040px]:py-7 max-[1040px]:pr-0 max-[1040px]:pl-0">
            <div className="text-[12px] font-semibold tracking-[0.14em] text-[#002fa7] uppercase">
              Trust
            </div>
            <h4 className="mt-3 max-w-[20ch] text-[clamp(1.45rem,2.5vw,1.85rem)] leading-[1.18] font-semibold tracking-[-0.025em] text-balance text-brand-navy">
              Can your members clearly see how funds are managed?
            </h4>
            <p className="mt-3.5 max-w-[34ch]">
              Limited transparency reduces trust and slows compliance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
