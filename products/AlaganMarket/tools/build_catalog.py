from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / "catalog"
EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

def txt(path):
    try:
        return path.read_text(encoding="utf-8-sig").strip()
    except OSError:
        return ""

def rel(path):
    return path.relative_to(ROOT).as_posix()

def image(folder, stem):
    for ext in sorted(EXTS):
        path = folder / (stem + ext)
        if path.is_file():
            return rel(path)
    return ""

def natural_key(path):
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", path.stem)]

def is_screenshot(path):
    if not path.is_file() or path.suffix.lower() not in EXTS:
        return False
    stem = path.stem.strip()
    if stem.lower() in {"preview", "header", "icon", "logo"}:
        return False
    # Accept screen-01, screenshot_02, screen 3, shot-04 and simple 1/01 names.
    return bool(re.fullmatch(r"(?:(?:screen|screenshot|shot)[-_ ]?)?\d+", stem, re.I))

categories = []
apps = []
suppliers = []

# Load public supplier profile metadata from accounts/*.json.
ACCOUNTS = ROOT / "accounts"
if ACCOUNTS.exists():
    for account_path in sorted(ACCOUNTS.glob("*.json")):
        try:
            meta = json.loads(account_path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            continue
        suppliers.append({
            "folder": account_path.stem,
            "display_name": meta.get("display_name", account_path.stem),
            "telegram_username": meta.get("telegram_username", ""),
            "telegram_user_id": str(meta.get("telegram_user_id", "")),
            "avatar": meta.get("avatar", ""),
            "version": meta.get("version", "")
        })

if CAT.exists():
    for category_dir in sorted(p for p in CAT.iterdir() if p.is_dir()):
        categories.append({
            "name": category_dir.name,
            "icon": image(category_dir, "preview")
        })
        for app_dir in sorted(p for p in category_dir.iterdir() if p.is_dir()):
            vendors = []
            for vendor_dir in sorted(p for p in app_dir.iterdir() if p.is_dir()):
                account_file = ROOT / "accounts" / (vendor_dir.name + ".json")
                try:
                    meta = json.loads(account_file.read_text(encoding="utf-8")) if account_file.exists() else {}
                except (OSError, json.JSONDecodeError):
                    meta = {}
                for apk in sorted(vendor_dir.glob("*.apk")):
                    vendors.append({
                        "name": meta.get("display_name", vendor_dir.name),
                        "avatar": meta.get("avatar", ""),
                        "telegram_username": meta.get("telegram_username", ""),
                        "telegram_user_id": str(meta.get("telegram_user_id", "")),
                        "version": meta.get("version", ""),
                        "file": rel(apk)
                    })

            screenshots = [
                rel(path) for path in sorted(app_dir.iterdir(), key=natural_key)
                if is_screenshot(path)
            ]
            apps.append({
                "id": re.sub(r"[^a-z0-9]+", "-", (category_dir.name + "-" + app_dir.name).lower()).strip("-"),
                "category": category_dir.name,
                "name": app_dir.name,
                "short": txt(app_dir / "mdesc.txt"),
                "description": txt(app_dir / "desc.txt"),
                "version": "",
                "icon": image(app_dir, "preview"),
                "header": image(app_dir, "header"),
                "screenshots": screenshots,
                "vendors": vendors
            })

(ROOT / "data").mkdir(exist_ok=True)
(ROOT / "data" / "catalog.json").write_text(
    json.dumps({"version": 3, "categories": categories, "suppliers": suppliers, "apps": apps},
               ensure_ascii=False, indent=2),
    encoding="utf-8"
)
print(f"Готово: {len(categories)} категорий, {len(apps)} приложений, {len(suppliers)} поставщиков")
