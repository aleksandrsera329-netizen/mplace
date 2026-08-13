"""Generate docs/INVESTOR_COST_SHEET.pdf — one-page A4."""
from fpdf import FPDF
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "docs" / "INVESTOR_COST_SHEET.pdf"
font = r"C:\Windows\Fonts\arial.ttf"
font_b = r"C:\Windows\Fonts\arialbd.ttf"


class PDF(FPDF):
    def footer(self):
        self.set_y(-10)
        self.set_font("Arial", size=7)
        self.set_text_color(120, 120, 120)
        self.cell(
            0,
            4,
            "Mplace Investor Cost Sheet  |  Confidential  |  2026-08  |  Not a valuation or offer",
            align="C",
        )


def main() -> None:
    pdf = PDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.add_font("Arial", "", font)
    pdf.add_font("Arial", "B", font_b)

    pdf.set_font("Arial", "B", 14)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(0, 7, "MPLACE — Investor Cost Sheet (1 page)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Arial", "", 8)
    pdf.set_text_color(80, 80, 90)
    pdf.multi_cell(
        0,
        3.5,
        "Multi-vendor B2B marketplace  |  NestJS + Next.js + PostgreSQL + Stripe  |  "
        "Stage 30: GO for pilot / investor demo  |  Asset = code + docs + tests (not ARR)",
    )
    pdf.ln(1)

    pdf.set_fill_color(230, 245, 235)
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(20, 80, 40)
    pdf.cell(
        0,
        5,
        "  Status: Pilot-ready  |  ~27k LOC API + ~10k LOC Web  |  52 models  |  "
        "57 Next routes  |  182 unit + 85 security tests",
        new_x="LMARGIN",
        new_y="NEXT",
        fill=True,
    )
    pdf.ln(2)

    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(0, 5, "1. Scope -> effort (from scratch rebuild)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(200, 200, 200)
    pdf.set_font("Arial", "B", 7)
    pdf.set_fill_color(245, 246, 248)
    pdf.set_text_color(40, 40, 50)
    cols = [95, 25, 30, 30]
    for i, h in enumerate(["Block", "Done", "Hours min", "Hours max"]):
        pdf.cell(cols[i], 4.5, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 7)
    rows = [
        ("Auth (JWT, refresh family, lockout, admin MFA)", "Yes", "120", "160"),
        ("Catalog, cart, checkout, wishlist", "Yes", "140", "180"),
        ("Buyer / Merchant / Admin cabinets (Next.js)", "Yes", "200", "280"),
        ("Payments (Stripe, webhooks, refunds)", "Yes", "160", "220"),
        ("Ledger + payouts (concurrency-safe)", "Yes", "120", "160"),
        ("RFQ -> offer -> award -> Order", "Yes", "120", "160"),
        ("KYC private + media ACL + file security", "Yes", "100", "140"),
        ("Search, jobs, notifications, multi-tenant", "Yes", "140", "200"),
        ("Security headers, rate limits, XSS, secrets", "Yes", "80", "120"),
        ("Ops: metrics, backup/DR, deploy docs", "Yes", "80", "120"),
        ("Tests + PRODUCTION_GATE", "Yes", "100", "140"),
        ("TOTAL engineering hours", "", "1,360", "1,880"),
    ]
    for r in rows:
        bold = r[0].startswith("TOTAL")
        pdf.set_font("Arial", "B" if bold else "", 7)
        for i, v in enumerate(r):
            pdf.cell(cols[i], 4, v, border=1)
        pdf.ln()
    pdf.set_font("Arial", "", 7)
    pdf.set_text_color(70, 70, 80)
    pdf.cell(
        0,
        4,
        "~ 8.5-12 person-months core  |  15-22 PM full product team (160 h/PM)",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(1.5)

    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        5,
        "2. Replacement cost (custom build) & IP asset value",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Arial", "B", 7)
    pdf.set_fill_color(245, 246, 248)
    cols2 = [50, 45, 45, 40]
    for i, h in enumerate(["Market", "Rate / PM", "15 PM", "20 PM"]):
        pdf.cell(cols2[i], 4.5, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 7)
    for r in [
        ("RF mid studio", "$3-5k", "$45-75k", "$60-100k"),
        ("RF senior-heavy", "$5-8k", "$75-120k", "$100-160k"),
        ("EU outsource", "$8-12k", "$120-180k", "$160-240k"),
        ("US product agency", "$15-22k", "$225-330k", "$300-440k"),
    ]:
        for i, v in enumerate(r):
            pdf.cell(cols2[i], 4, v, border=1)
        pdf.ln()

    pdf.ln(1)
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        4.5,
        "RUB rebuild (~90 RUB/$):  realistic 12-20M RUB  |  lean cut 8-12M  |  West 25-40M+",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_fill_color(235, 242, 255)
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(20, 40, 90)
    pdf.cell(
        0,
        5,
        "  Fair code/IP sale (no customers):  $80-150k  ·  7-14M RUB   |   "
        "+handover/support: $120-200k",
        new_x="LMARGIN",
        new_y="NEXT",
        fill=True,
    )
    pdf.ln(1.5)

    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(0, 5, "3. Bottom line & 90-day buffer", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Arial", "", 7)
    pdf.set_text_color(40, 40, 50)
    y0 = pdf.get_y()
    w = 60
    boxes = [
        ("Rebuild (RF)", "$100-200k\n12-20M RUB"),
        ("Fair IP asset", "$80-150k\n7-14M RUB"),
        ("90d go-live buffer", "3-7M RUB\nStripe/ops/UX/E2E"),
    ]
    for i, (t, b) in enumerate(boxes):
        x = 10 + i * (w + 3)
        pdf.set_xy(x, y0)
        pdf.set_fill_color(248, 249, 251)
        pdf.set_draw_color(180, 190, 210)
        pdf.rect(x, y0, w, 16, style="DF")
        pdf.set_xy(x + 2, y0 + 1.5)
        pdf.set_font("Arial", "B", 7)
        pdf.cell(w - 4, 4, t, new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(x + 2)
        pdf.set_font("Arial", "", 8)
        pdf.multi_cell(w - 4, 3.5, b)

    pdf.set_y(y0 + 18)
    pdf.set_font("Arial", "", 7)
    pdf.set_text_color(90, 90, 100)
    pdf.multi_cell(
        0,
        3.2,
        "Not a company valuation or investment offer. Equity value = team + market + traction. "
        "Gaps: UX polish, live Stripe ops, full browser E2E, CSP nonces. "
        "Sources: internal LOC/modules, Stages 0-30, PRODUCTION_GATE (2026-08). "
        "Rates market-indicative.",
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out))
    print("wrote", out)
    print("size", out.stat().st_size)


if __name__ == "__main__":
    main()
