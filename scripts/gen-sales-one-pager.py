"""Generate docs/SALES_ONE_PAGER.pdf — buyer-facing 1 page (EN)."""
from fpdf import FPDF
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "docs" / "SALES_ONE_PAGER.pdf"
font = r"C:\Windows\Fonts\arial.ttf"
font_b = r"C:\Windows\Fonts\arialbd.ttf"


class PDF(FPDF):
    def footer(self):
        self.set_y(-10)
        self.set_font("Arial", size=7)
        self.set_text_color(110, 110, 120)
        self.cell(
            0,
            4,
            "Mplace Energy  |  Sales one-pager  |  Confidential  |  2026-08  |  Live demo: mplace-vu4o.onrender.com",
            align="C",
        )


def h(pdf: PDF, title: str) -> None:
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(0, 5.5, title, new_x="LMARGIN", new_y="NEXT")


def body(pdf: PDF, text: str, size: int = 8) -> None:
    pdf.set_font("Arial", "", size)
    pdf.set_text_color(45, 50, 60)
    pdf.multi_cell(0, 3.6, text)


def main() -> None:
    pdf = PDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False, margin=12)
    pdf.add_page()
    pdf.add_font("Arial", "", font)
    pdf.add_font("Arial", "B", font_b)

    # Title
    pdf.set_font("Arial", "B", 16)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(0, 8, "MPLACE ENERGY", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Arial", "B", 11)
    pdf.set_text_color(180, 120, 20)
    pdf.cell(
        0,
        5,
        "B2B Oil & Gas Procurement Marketplace  |  Software asset for acquisition / pilot",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(1)

    pdf.set_fill_color(245, 248, 252)
    pdf.set_font("Arial", "", 8)
    pdf.set_text_color(30, 40, 55)
    pdf.multi_cell(
        0,
        4,
        "  Live public demo (always-on):  https://mplace-vu4o.onrender.com\n"
        "  Request private demo (admin / seller / full RFQ):  /request-demo.html\n"
        "  Source: GitHub aleksandrsera329-netizen/mplace  |  Stack: NestJS + PostgreSQL (Neon) + static storefront",
        fill=True,
    )
    pdf.ln(2)

    h(pdf, "1. What it is")
    body(
        pdf,
        "Multi-vendor B2B marketplace for oil & gas equipment and MRO: catalog, cart/order list, RFQ "
        "(request -> supplier offers -> award), merchant desk, platform admin. Built to save a buyer "
        "6-12 months of platform engineering versus greenfield.",
    )
    pdf.ln(1)

    h(pdf, "2. Product features (demo-ready)")
    pdf.set_font("Arial", "", 8)
    pdf.set_text_color(40, 45, 55)
    features = [
        ("Public storefront", "EN catalog, search/filters, product cards, cart, RFQ entry, private-demo CTA"),
        ("Procurement", "Orders + RFQ workflow (open quotes, multi-supplier offers, award path)"),
        ("Suppliers", "5 verified demo shops, inventory stock, merchant cabinet (private login)"),
        ("Admin", "Users, shops, orders, payouts, support tickets (private login)"),
        ("Security base", "JWT auth, role model, pilot mode without Stripe/Redis for cheap hosting"),
        ("Ops", "Docker + Render Starter (no cold sleep), Neon Postgres, migrate-on-boot"),
    ]
    cols = [38, 142]
    pdf.set_font("Arial", "B", 7)
    pdf.set_fill_color(240, 242, 245)
    pdf.cell(cols[0], 4.5, "Area", border=1, fill=True)
    pdf.cell(cols[1], 4.5, "What you get in the demo", border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 7)
    for a, b in features:
        pdf.cell(cols[0], 4.2, a, border=1)
        pdf.cell(cols[1], 4.2, b, border=1)
        pdf.ln()
    pdf.ln(1.5)

    h(pdf, "3. Technology")
    body(
        pdf,
        "NestJS 11 API  ·  Prisma 6  ·  PostgreSQL (Neon)  ·  JWT auth  ·  RFQ/orders/ledger modules  ·  "
        "Docker single-service deploy  ·  Optional Next.js web app in monorepo  ·  Pilot mode (ALLOW_PILOT) "
        "for production without Stripe/Redis/Meilisearch.",
    )
    pdf.ln(1)

    h(pdf, "4. Commercial framing (not a company valuation)")
    cols2 = [55, 55, 70]
    pdf.set_font("Arial", "B", 7)
    pdf.set_fill_color(240, 242, 245)
    for i, t in enumerate(["Metric", "Range", "Notes"]):
        pdf.cell(cols2[i], 4.5, t, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 7)
    rows = [
        ("Rebuild cost (indicative)", "12-20M RUB / $80-160k", "Custom agency, 12-20 PM"),
        ("Fair IP / code asset", "$80-150k  |  7-14M RUB", "Quality + docs + tests"),
        ("Listing guidance", "~15M RUB", "Negotiable + handover"),
        ("Hosting (demo)", "~$7/mo Render Starter", "Always-on public demo"),
    ]
    for r in rows:
        for i, v in enumerate(r):
            pdf.cell(cols2[i], 4.2, v, border=1)
        pdf.ln()
    pdf.ln(1.5)

    h(pdf, "5. What is public vs private")
    body(
        pdf,
        "PUBLIC: catalog, product, cart, RFQ create, request-demo form, clean sign-in (no passwords on page).\n"
        "PRIVATE (NDA / scheduled walkthrough): temporary logins for buyer, merchant, super-admin; "
        "full RFQ award, seller stock/orders, admin payouts/support. Source access after NDA.",
    )
    pdf.ln(1)

    h(pdf, "6. Contact")
    pdf.set_fill_color(255, 248, 230)
    pdf.set_font("Arial", "B", 9)
    pdf.set_text_color(40, 40, 30)
    pdf.multi_cell(
        0,
        4.5,
        "  Email: aleksandrsera329@gmail.com\n"
        "  Demo: https://mplace-vu4o.onrender.com\n"
        "  Private demo request: https://mplace-vu4o.onrender.com/request-demo.html",
        fill=True,
    )

    pdf.output(out)
    print("Wrote", out)


if __name__ == "__main__":
    main()
