"""Generate docs/INVESTOR_COST_SHEET_RU.pdf — one-page A4 (Russian)."""
from fpdf import FPDF
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "docs" / "INVESTOR_COST_SHEET_RU.pdf"
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
            "Mplace Investor Cost Sheet (RU)  |  Конфиденциально  |  2026-08  |  Не valuation и не оферта",
            align="C",
        )


def main() -> None:
    pdf = PDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.add_font("Arial", "", font)
    pdf.add_font("Arial", "B", font_b)

    pdf.set_font("Arial", "B", 13)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        6.5,
        "MPLACE — Investor Cost Sheet (1 страница, RU)",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Arial", "", 7.5)
    pdf.set_text_color(80, 80, 90)
    pdf.multi_cell(
        0,
        3.3,
        "Multi-vendor B2B marketplace (Oil & Gas)  |  NestJS + Next.js + PostgreSQL + Stripe  |  "
        "Этап 30: GO к пилоту / демо инвестору  |  Ассет = код + доки + тесты (не ARR)",
    )
    pdf.ln(0.8)

    pdf.set_fill_color(230, 245, 235)
    pdf.set_font("Arial", "B", 7.5)
    pdf.set_text_color(20, 80, 40)
    pdf.cell(
        0,
        4.8,
        "  Статус: Pilot-ready  |  ~27k LOC API + ~10k LOC Web  |  52 модели  |  "
        "~57 Next routes  |  182 unit + 85 security тестов",
        new_x="LMARGIN",
        new_y="NEXT",
        fill=True,
    )
    pdf.ln(1.5)

    # Section 1
    pdf.set_font("Arial", "B", 9.5)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        4.5,
        "1. Scope → трудозатраты (пересборка с нуля)",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_draw_color(200, 200, 200)
    pdf.set_font("Arial", "B", 6.5)
    pdf.set_fill_color(245, 246, 248)
    pdf.set_text_color(40, 40, 50)
    cols = [100, 18, 26, 26]
    for i, h in enumerate(["Блок", "Готово", "Часы min", "Часы max"]):
        pdf.cell(cols[i], 4.2, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 6.5)
    rows = [
        ("Auth (JWT, refresh family, lockout, admin MFA)", "Да", "120", "160"),
        ("Каталог, корзина, checkout, wishlist", "Да", "140", "180"),
        ("Кабинеты Buyer / Merchant / Admin (Next.js)", "Да", "200", "280"),
        ("Платежи (Stripe, webhooks, refunds)", "Да", "160", "220"),
        ("Ledger + payouts (concurrency-safe)", "Да", "120", "160"),
        ("RFQ → offer → award → Order", "Да", "120", "160"),
        ("KYC private + media ACL + file security", "Да", "100", "140"),
        ("Search, jobs, notifications, multi-tenant", "Да", "140", "200"),
        ("Security headers, rate limits, XSS, secrets", "Да", "80", "120"),
        ("Ops: metrics, backup/DR, deploy docs", "Да", "80", "120"),
        ("Тесты + PRODUCTION_GATE", "Да", "100", "140"),
        ("ИТОГО engineering (часы)", "", "1 360", "1 880"),
    ]
    for r in rows:
        bold = r[0].startswith("ИТОГО")
        pdf.set_font("Arial", "B" if bold else "", 6.5)
        for i, v in enumerate(r):
            pdf.cell(cols[i], 3.8, v, border=1)
        pdf.ln()
    pdf.set_font("Arial", "", 6.5)
    pdf.set_text_color(70, 70, 80)
    pdf.cell(
        0,
        3.8,
        "≈ 8,5–12 чел.-мес. core  ·  15–22 PM full product team (160 ч / PM)",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(1.2)

    # Section 2
    pdf.set_font("Arial", "B", 9.5)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        4.5,
        "2. Стоимость пересборки (custom) и цена IP",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Arial", "B", 6.5)
    pdf.set_fill_color(245, 246, 248)
    cols2 = [48, 42, 40, 40]
    for i, h in enumerate(["Рынок", "Ставка / PM", "15 PM", "20 PM"]):
        pdf.cell(cols2[i], 4.2, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 6.5)
    for r in [
        ("РФ mid-студия", "$3–5k", "$45–75k", "$60–100k"),
        ("РФ senior-heavy", "$5–8k", "$75–120k", "$100–160k"),
        ("EU outsource", "$8–12k", "$120–180k", "$160–240k"),
        ("US product agency", "$15–22k", "$225–330k", "$300–440k"),
    ]:
        for i, v in enumerate(r):
            pdf.cell(cols2[i], 3.8, v, border=1)
        pdf.ln()

    pdf.ln(0.8)
    pdf.set_font("Arial", "B", 7.5)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        4,
        "RUB пересборка (≈90 ₽/$):  реалистично 12–20 млн ₽  |  lean 8–12 млн  |  West 25–40+ млн",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_fill_color(235, 242, 255)
    pdf.set_font("Arial", "B", 7.5)
    pdf.set_text_color(20, 40, 90)
    pdf.cell(
        0,
        4.8,
        "  Справедливая продажа кода/IP (без клиентов):  $80–150k  ·  7–14 млн ₽   |   "
        "+handover/support: $120–200k",
        new_x="LMARGIN",
        new_y="NEXT",
        fill=True,
    )
    pdf.ln(1.2)

    # Section 3
    pdf.set_font("Arial", "B", 9.5)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(
        0,
        4.5,
        "3. Итог и буфер на 90 дней",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.set_font("Arial", "", 7)
    pdf.set_text_color(40, 40, 50)
    y0 = pdf.get_y()
    w = 60
    boxes = [
        ("Пересборка (РФ)", "$100–200k\n12–20 млн ₽"),
        ("Справедливый IP", "$80–150k\n7–14 млн ₽"),
        ("Буфер 90 дней", "3–7 млн ₽\nStripe / ops / UX / E2E"),
    ]
    for i, (t, b) in enumerate(boxes):
        x = 10 + i * (w + 3)
        pdf.set_xy(x, y0)
        pdf.set_fill_color(248, 249, 251)
        pdf.set_draw_color(180, 190, 210)
        pdf.rect(x, y0, w, 15, style="DF")
        pdf.set_xy(x + 2, y0 + 1.2)
        pdf.set_font("Arial", "B", 7)
        pdf.cell(w - 4, 3.5, t, new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(x + 2)
        pdf.set_font("Arial", "", 7.5)
        pdf.multi_cell(w - 4, 3.3, b)

    pdf.set_y(y0 + 16.5)
    pdf.set_font("Arial", "", 6.5)
    pdf.set_text_color(90, 90, 100)
    pdf.multi_cell(
        0,
        3.0,
        "Не valuation компании и не инвестиционная оферта. Equity value = команда + рынок + traction. "
        "Пробелы: UX polish, live Stripe ops, full browser E2E, CSP nonces. "
        "Источники: internal LOC/modules, этапы 0–30, PRODUCTION_GATE (2026-08). "
        "Ставки — рыночный ориентир.",
    )

    out.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out))
    print("wrote", out)
    print("size", out.stat().st_size)


if __name__ == "__main__":
    main()
