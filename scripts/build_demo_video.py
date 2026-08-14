"""Build full demo walkthrough video from screenshots + title cards."""
from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "sales-assets" / "walkthrough"
OUT.mkdir(parents=True, exist_ok=True)
VIDEO = ROOT / "docs" / "sales-assets" / "mplace-demo-walkthrough.mp4"
W, H = 1280, 720
FONT = r"C:\Windows\Fonts\arial.ttf"
FONT_B = r"C:\Windows\Fonts\arialbd.ttf"


def load_font(path: str, size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def title_card(path: Path, title: str, subtitle: str = "", timing: str = "") -> None:
    img = Image.new("RGB", (W, H), (15, 23, 42))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 12, H], fill=(245, 158, 11))
    d.rectangle([0, H - 8, W, H], fill=(245, 158, 11))
    f_title = load_font(FONT_B, 42)
    f_sub = load_font(FONT, 24)
    f_small = load_font(FONT, 18)
    d.text((48, 48), "MPLACE ENERGY", fill=(245, 158, 11), font=load_font(FONT_B, 20))
    d.text(
        (48, 78),
        "Oil & Gas B2B Marketplace — Live Demo Walkthrough",
        fill=(100, 116, 139),
        font=f_small,
    )
    d.text((48, 220), title, fill=(248, 250, 252), font=f_title)
    if subtitle:
        y = 290
        for line in textwrap.wrap(subtitle, width=52):
            d.text((48, y), line, fill=(148, 163, 184), font=f_sub)
            y += 34
    if timing:
        d.text((48, H - 80), timing, fill=(245, 158, 11), font=f_small)
    img.save(path)
    print("card", path.name)


def fit(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGB")
    scale = max(W / im.width, H / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - W) // 2
    top = (nh - H) // 2
    im = im.crop((left, top, left + W, top + H))
    im.save(dst, quality=92)
    print("fit", src.name, "->", dst.name)


def main() -> None:
    cards = [
        ("t00_open.png", "0:00 — Opening", "B2B marketplace for oil & gas procurement", "0:00–0:40"),
        ("t01_catalog.png", "0:40 — Catalog & Search", "Browse equipment, filter suppliers, open products", "0:40–2:00"),
        ("t02_order.png", "2:00 — Order / Request", "Cart drawer and procurement checkout path", "2:00–3:00"),
        ("t03_rfq.png", "3:00 — RFQ Workflow", "Request quotes from multiple suppliers", "3:00–4:30"),
        ("t04_seller.png", "4:30 — Seller Desk", "Products, stock and incoming orders", "4:30–5:30"),
        ("t05_admin.png", "5:30 — Admin Console", "Platform ops — MFA-protected private access", "5:30–6:30"),
        ("t06_close.png", "6:30 — Closing", "Ready foundation — saves 6–12 months of build", "6:30–7:00"),
        (
            "t07_end.png",
            "Thank you",
            "Demo: https://mplace-vu4o.onrender.com  |  Private demo: /request-demo.html  |  Contact: aleksandrsera329@gmail.com",
            "",
        ),
    ]
    for name, title, sub, timing in cards:
        title_card(OUT / name, title, sub, timing)

    shots = [
        "01_home.png",
        "02_home_catalog.png",
        "03_search_valve.png",
        "04_product.png",
        "05_cart_drawer.png",
        "06_cart_page.png",
        "07_rfq_create.png",
        "09_merchant_after_login.png",
        "10_merchant.png",
        "11_merchant_products.png",
        "12_merchant_orders.png",
        "15_buyer_rfqs.png",
        "16_buyer_orders.png",
        "17_buyer_account.png",
        "08_request_demo.png",
    ]
    for s in shots:
        p = OUT / s
        if p.exists() and p.stat().st_size > 20000:
            fit(p, OUT / f"f_{s}")

    # ~6.5 minutes following script proportions
    seq = [
        ("t00_open.png", 6),
        ("f_01_home.png", 28),
        ("f_02_home_catalog.png", 12),
        ("t01_catalog.png", 5),
        ("f_03_search_valve.png", 22),
        ("f_04_product.png", 28),
        ("t02_order.png", 5),
        ("f_05_cart_drawer.png", 18),
        ("f_06_cart_page.png", 25),
        ("t03_rfq.png", 5),
        ("f_07_rfq_create.png", 35),
        ("f_15_buyer_rfqs.png", 25),
        ("f_16_buyer_orders.png", 20),
        ("t04_seller.png", 5),
        ("f_09_merchant_after_login.png", 22),
        ("f_10_merchant.png", 18),
        ("f_11_merchant_products.png", 15),
        ("f_12_merchant_orders.png", 15),
        ("t05_admin.png", 10),
        ("f_17_buyer_account.png", 15),
        ("t06_close.png", 6),
        ("f_08_request_demo.png", 22),
        ("t07_end.png", 12),
    ]

    final: list[tuple[str, int]] = []
    for name, dur in seq:
        if (OUT / name).exists():
            final.append((name, dur))
        else:
            print("SKIP missing", name)

    total = sum(d for _, d in final)
    print(f"TOTAL_SECONDS {total} (~{total // 60}m{total % 60:02d}s) clips={len(final)}")

    list_path = OUT / "concat.txt"
    with list_path.open("w", encoding="ascii") as f:
        for name, dur in final:
            f.write(f"file '{name}'\n")
            f.write(f"duration {dur}\n")
        f.write(f"file '{final[-1][0]}'\n")

    (OUT / "TIMELINE.txt").write_text(
        "\n".join(f"{i + 1:02d}. {n}  {d}s" for i, (n, d) in enumerate(final))
        + f"\n\nTOTAL ~{total // 60}m{total % 60:02d}s\n",
        encoding="utf-8",
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_path.name),
        "-vf",
        "fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(VIDEO),
    ]
    print("Running", " ".join(cmd))
    subprocess.run(cmd, cwd=OUT, check=True)
    print("Wrote", VIDEO, "size", VIDEO.stat().st_size)


if __name__ == "__main__":
    main()
