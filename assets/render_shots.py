"""Screenshot the HTML terminals into PNGs for the README.

    python3 assets/render_shots.py
"""
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
SHOTS = [
    ("scan.html", "scan.png"),
    ("vet-repo.html", "vet-repo.png"),
    ("watch.html", "watch.png"),
    ("gate.html", "gate.png"),
]


async def render(html: Path, png: Path) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            args=["--disable-web-security"],
        )
        page = await browser.new_page(
            viewport={"width": 1100, "height": 900},
            device_scale_factor=2,
        )
        await page.goto(html.as_uri(), wait_until="networkidle")
        await page.wait_for_timeout(600)
        el = await page.query_selector(".window")
        if el is None:
            raise SystemExit(f"no .window in {html.name}")
        await el.screenshot(path=str(png))
        await browser.close()
        print("wrote", png.name)


async def main() -> None:
    for src, dst in SHOTS:
        await render(ROOT / src, ROOT / dst)


if __name__ == "__main__":
    asyncio.run(main())
