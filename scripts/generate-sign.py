#!/usr/bin/env python3

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
QR_PATH = ROOT / "public" / "pink-door-qr.png"
OUTPUT_PATH = ROOT / "output" / "pdf" / "the-house-with-the-pink-door-sign.pdf"
PUBLIC_PATH = ROOT / "public" / "the-house-with-the-pink-door-sign.pdf"

INK = HexColor("#171316")
PAPER = HexColor("#FFF8FB")
PINK = HexColor("#F52975")
PINK_DEEP = HexColor("#C71659")
CHARTREUSE = HexColor("#B9EE57")
CYAN = HexColor("#57D7E8")


def centered_text(canvas: Canvas, text: str, y: float, font: str, size: float, color) -> None:
    canvas.setFont(font, size)
    canvas.setFillColor(color)
    canvas.drawString((letter[0] - stringWidth(text, font, size)) / 2, y, text)


def build_sign(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(path), pagesize=letter)
    width, height = letter

    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)

    canvas.setFillColor(INK)
    canvas.rect(0, height - 190, width, 190, fill=1, stroke=0)

    # A restrained door mark that matches the public site without depicting a house.
    door_x, door_y, door_w, door_h = 50, height - 162, 70, 116
    canvas.setFillColor(PINK)
    canvas.rect(door_x, door_y, door_w, door_h, fill=1, stroke=0)
    canvas.setStrokeColor(PINK_DEEP)
    canvas.setLineWidth(5)
    canvas.rect(door_x + 6, door_y + 6, door_w - 12, door_h - 12, fill=0, stroke=1)
    canvas.setFillColor(CHARTREUSE)
    canvas.circle(door_x + door_w - 15, door_y + 54, 4, fill=1, stroke=0)

    canvas.setFillColor(PAPER)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(144, height - 74, "THE HOUSE WITH")
    canvas.setFont("Helvetica-Bold", 29)
    canvas.drawString(144, height - 112, "THE PINK DOOR")
    canvas.setFillColor(CYAN)
    canvas.setFont("Helvetica", 13)
    canvas.drawString(144, height - 140, "A different verified light theme every evening")

    qr_size = 330
    qr_x = (width - qr_size) / 2
    qr_y = 188
    canvas.drawImage(
        ImageReader(str(QR_PATH)),
        qr_x,
        qr_y,
        qr_size,
        qr_size,
        preserveAspectRatio=True,
        mask="auto",
    )

    centered_text(
        canvas,
        "SCAN TO VOTE FOR TONIGHT'S THEME",
        142,
        "Helvetica-Bold",
        18,
        INK,
    )
    centered_text(
        canvas,
        "Voting opens at 8:00 AM and closes at 5:50 PM Pacific.",
        116,
        "Helvetica",
        11,
        INK,
    )
    centered_text(
        canvas,
        "house-with-pink-door.hey-aw.chatgpt.site",
        76,
        "Helvetica",
        9,
        PINK_DEEP,
    )

    canvas.setFillColor(PINK)
    canvas.rect(0, 0, width, 30, fill=1, stroke=0)
    canvas.showPage()
    canvas.save()


build_sign(OUTPUT_PATH)
PUBLIC_PATH.write_bytes(OUTPUT_PATH.read_bytes())
print(f"Generated {OUTPUT_PATH}")
