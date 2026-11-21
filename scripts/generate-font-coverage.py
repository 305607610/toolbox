"""Generate the Unicode coverage sets for the bundled seal fonts.

Run from the project root:
    python scripts/generate-font-coverage.py

The app uses this JSON to detect missing glyphs before export. It reads the
font cmap directly; document.fonts.check cannot answer glyph coverage.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = {
    "JFZSK": ROOT / "public" / "fonts" / "JFZSKSealScript_V3.5.ttf",
    "ChongXi": ROOT / "public" / "fonts" / "chongxi_seal.otf",
}
OUT = ROOT / "src" / "seal" / "fontCoverage.json"


def coverage(path: Path) -> list[int]:
    with path.open("rb") as handle:
        font = TTFont(io.BytesIO(handle.read()), fontNumber=0)
    codepoints: set[int] = set()
    for table in font["cmap"].tables:
        if table.isUnicode():
            codepoints.update(table.cmap.keys())
    return sorted(codepoints)


def main() -> None:
    payload = {name: coverage(path) for name, path in FONTS.items()}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    for name, points in payload.items():
        print(f"{name}: {len(points)} codepoints")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()