"""Generate docs/SALES_ONE_PAGER_RU.pdf — 1 page (RU)."""
from fpdf import FPDF
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "docs" / "SALES_ONE_PAGER_RU.pdf"
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
            "Mplace Energy  |  Одностраничник для продажи  |  Конфиденциально  |  2026-08  |  mplace-vu4o.onrender.com",
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

    pdf.set_font("Arial", "B", 16)
    pdf.set_text_color(20, 30, 50)
    pdf.cell(0, 8, "MPLACE ENERGY", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Arial", "B", 11)
    pdf.set_text_color(180, 120, 20)
    pdf.cell(
        0,
        5,
        "B2B-маркетплейс закупок для нефтегаза  |  Софт-актив для продажи / пилота",
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
        "  Публичное демо (always-on):  https://mplace-vu4o.onrender.com\n"
        "  Private demo (admin / seller / полный RFQ):  /request-demo.html\n"
        "  Код: GitHub aleksandrsera329-netizen/mplace  |  NestJS + PostgreSQL (Neon) + витрина",
        fill=True,
    )
    pdf.ln(2)

    h(pdf, "1. Что это")
    body(
        pdf,
        "Мультивендорная B2B-площадка для оборудования и MRO нефтегаза: каталог, корзина/заявка, "
        "RFQ (запрос -> предложения поставщиков -> выбор), кабинет продавца, админка. "
        "Покупателю экономит 6-12 месяцев разработки платформы с нуля.",
    )
    pdf.ln(1)

    h(pdf, "2. Функции (готово к демо)")
    cols = [40, 140]
    pdf.set_font("Arial", "B", 7)
    pdf.set_fill_color(240, 242, 245)
    pdf.cell(cols[0], 4.5, "Блок", border=1, fill=True)
    pdf.cell(cols[1], 4.5, "В демо", border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 7)
    for a, b in [
        ("Публичная витрина", "EN-каталог, фильтры, карточки, корзина, RFQ, кнопка Private Demo"),
        ("Закупки", "Заказы + RFQ (котировки, офферы, award)"),
        ("Поставщики", "5 demo-shops, остатки, merchant-кабинет (private login)"),
        ("Админ", "Пользователи, shops, заказы, payouts, support (private login)"),
        ("Безопасность", "JWT, роли, pilot-режим без Stripe/Redis для дешёвого хостинга"),
        ("Ops", "Docker + Render Starter (не засыпает), Neon, migrate при старте"),
    ]:
        pdf.cell(cols[0], 4.2, a, border=1)
        pdf.cell(cols[1], 4.2, b, border=1)
        pdf.ln()
    pdf.ln(1.5)

    h(pdf, "3. Технологии")
    body(
        pdf,
        "NestJS 11  ·  Prisma 6  ·  PostgreSQL (Neon)  ·  JWT  ·  RFQ/orders/ledger  ·  Docker  ·  "
        "в монорепо есть Next.js  ·  ALLOW_PILOT для prod без Stripe/Redis/Meili.",
    )
    pdf.ln(1)

    h(pdf, "4. Коммерция (не оценка компании)")
    cols2 = [55, 55, 70]
    pdf.set_font("Arial", "B", 7)
    pdf.set_fill_color(240, 242, 245)
    for i, t in enumerate(["Метрика", "Диапазон", "Комментарий"]):
        pdf.cell(cols2[i], 4.5, t, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Arial", "", 7)
    for r in [
        ("Стоимость пересборки", "12-20 млн ₽", "Студия, 12-20 чел·мес"),
        ("Справедливая цена IP", "7-14 млн ₽ / $80-150k", "Код + docs + тесты"),
        ("Листинг (ориентир)", "~15 млн ₽", "Торг + handover"),
        ("Хостинг демо", "~$7/мес Render", "Always-on"),
    ]:
        for i, v in enumerate(r):
            pdf.cell(cols2[i], 4.2, v, border=1)
        pdf.ln()
    pdf.ln(1.5)

    h(pdf, "5. Публично vs private")
    body(
        pdf,
        "ПУБЛИЧНО: каталог, товар, корзина, создание RFQ, request-demo, чистый login (без паролей на странице).\n"
        "PRIVATE (NDA / созвон): временные логины buyer/merchant/admin; полный RFQ, остатки, payouts. "
        "Исходники — после NDA.",
    )
    pdf.ln(1)

    h(pdf, "6. Контакты")
    pdf.set_fill_color(255, 248, 230)
    pdf.set_font("Arial", "B", 9)
    pdf.set_text_color(40, 40, 30)
    pdf.multi_cell(
        0,
        4.5,
        "  Email: aleksandrsera329@gmail.com\n"
        "  Демо: https://mplace-vu4o.onrender.com\n"
        "  Заявка на private demo: https://mplace-vu4o.onrender.com/request-demo.html",
        fill=True,
    )

    pdf.output(out)
    print("Wrote", out)


if __name__ == "__main__":
    main()
