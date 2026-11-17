"""Copy the canonical local panel bridge into mods, whose imports are folder-local."""
from pathlib import Path
import sys

mods = Path(__file__).resolve().parents[1]
source = (mods / "local-tools/panels.js").read_bytes()
failed = []
for name in ("local-magpie", "local-komari", "local-cloudflare", "local-tapd", "local-issues"):
    target = mods / name / "panels.js"
    if "--check" in sys.argv:
        if not target.exists() or target.read_bytes() != source:
            failed.append(name)
    else:
        target.write_bytes(source)
if failed:
    raise SystemExit("Panel bridge differs: " + ", ".join(failed))
print("Local panel bridges match." if "--check" in sys.argv else "Local panel bridges copied.")
shared = mods.parent / "integrations/shepherdr/core/context-source.js"
target = mods / "local-issues/context-source.js"
if "--check" in sys.argv:
    if target.read_bytes() != shared.read_bytes():
        raise SystemExit("Issue source helper differs")
else:
    target.write_bytes(shared.read_bytes())
