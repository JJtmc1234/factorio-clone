from __future__ import annotations

import hashlib
import html
import json
import pathlib
import re
import urllib.parse
import zipfile
from typing import Any

import requests

OUT = pathlib.Path("result")
DOWNLOADS = OUT / "downloads"
NOTE_KEY = "nff719a8e0603"
ARTICLE_URL = f"https://note.com/lazy_kojocho/n/{NOTE_KEY}"
API_URL = f"https://note.com/api/v3/notes/{NOTE_KEY}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "Accept": "application/json,text/html,application/xhtml+xml,*/*",
    "Referer": ARTICLE_URL,
}


def flatten_strings(value: Any) -> list[str]:
    out: list[str] = []
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for key, item in value.items():
            out.append(str(key))
            out.extend(flatten_strings(item))
    elif isinstance(value, list):
        for item in value:
            out.extend(flatten_strings(item))
    return out


def safe_name(value: str, fallback: str) -> str:
    value = pathlib.PurePosixPath(value).name
    value = re.sub(r"[^A-Za-z0-9._()\- ]+", "_", value)[:160]
    return value or fallback


def attachment_filename(headers: requests.structures.CaseInsensitiveDict[str], final_url: str, index: int) -> str:
    disposition = headers.get("content-disposition", "")
    match = re.search(r"filename\*=UTF-8''([^;]+)", disposition, re.I)
    if match:
        return safe_name(urllib.parse.unquote(match.group(1)), f"candidate-{index}.bin")
    match = re.search(r'''filename=["']?([^"';]+)''', disposition, re.I)
    if match:
        return safe_name(match.group(1).strip(), f"candidate-{index}.bin")
    url_name = pathlib.PurePosixPath(urllib.parse.urlparse(final_url).path).name
    return safe_name(url_name, f"candidate-{index}.bin")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    records: list[dict[str, Any]] = []
    texts: list[str] = []
    api_data: Any = None

    for label, url in (("api", API_URL), ("article", ARTICLE_URL)):
        response = session.get(url, headers=HEADERS, timeout=90, allow_redirects=True)
        records.append(
            {
                "kind": label,
                "url": url,
                "status": response.status_code,
                "final_url": response.url,
                "content_type": response.headers.get("content-type"),
                "bytes": len(response.content),
            }
        )
        response.raise_for_status()
        suffix = "json" if label == "api" else "html"
        (OUT / f"note-{label}.{suffix}").write_bytes(response.content)
        texts.append(response.text)
        if label == "api":
            try:
                api_data = response.json()
                (OUT / "note-api.pretty.json").write_text(
                    json.dumps(api_data, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                texts.extend(flatten_strings(api_data))
            except Exception as exc:
                records[-1]["json_error"] = repr(exc)

    combined = html.unescape("\n".join(texts))
    combined += "\n" + urllib.parse.unquote(combined)
    (OUT / "combined-decoded.txt").write_text(combined, encoding="utf-8")

    urls: set[str] = set()
    keys: set[str] = set()

    for match in re.finditer(r'''https?://[^\s"'<>\\]+''', combined):
        urls.add(match.group(0).rstrip("),.;]"))

    key_patterns = (
        r"/api/v2/attachments/download/([A-Za-z0-9_-]{8,128})",
        r"attachments?/download/([A-Za-z0-9_-]{8,128})",
        r'''(?:attachment|file)(?:Key|_key|Id|_id|Hash|_hash)["'=:\s]+([A-Za-z0-9_-]{8,128})''',
        r'''data-(?:attachment|file)-(?:key|id|hash)=["']([^"']+)''',
    )
    for pattern in key_patterns:
        for match in re.finditer(pattern, combined, re.I):
            keys.add(match.group(1))

    for pattern in (
        r"(?is)(?:attachment|download|file|zip).{0,240}?\b([0-9a-f]{32})\b",
        r"(?is)\b([0-9a-f]{32})\b.{0,240}?(?:attachment|download|file|zip)",
    ):
        for match in re.finditer(pattern, combined):
            keys.add(match.group(1))

    if api_data is not None:
        raw_json = json.dumps(api_data, ensure_ascii=False)
        for match in re.finditer(r'''(?i)"(?:key|hash|attachment_key|file_key)"\s*:\s*"([0-9a-f]{32})"''', raw_json):
            keys.add(match.group(1))

    for key in keys:
        urls.add(f"https://note.com/api/v2/attachments/download/{key}")

    likely_urls: list[str] = []
    for url in sorted(urls):
        lower = url.lower()
        if any(
            token in lower
            for token in (
                "attachment",
                "download",
                ".zip",
                "drive.google",
                "dropbox",
                "onedrive",
                "storage.googleapis",
                "amazonaws",
                "assets.st-note",
            )
        ):
            likely_urls.append(url)

    (OUT / "candidate-keys.txt").write_text(
        "\n".join(sorted(keys)) + ("\n" if keys else ""), encoding="utf-8"
    )
    (OUT / "candidate-urls.txt").write_text(
        "\n".join(likely_urls) + ("\n" if likely_urls else ""), encoding="utf-8"
    )

    attempts: list[dict[str, Any]] = []
    valid_saves: list[str] = []
    seen_hashes: set[str] = set()

    for index, url in enumerate(likely_urls[:100], start=1):
        record: dict[str, Any] = {"url": url}
        try:
            response = session.get(url, headers=HEADERS, timeout=180, allow_redirects=True)
            record.update(
                {
                    "status": response.status_code,
                    "final_url": response.url,
                    "content_type": response.headers.get("content-type", ""),
                    "content_disposition": response.headers.get("content-disposition", ""),
                    "bytes": len(response.content),
                    "sha256": hashlib.sha256(response.content).hexdigest(),
                }
            )
            response.raise_for_status()
            if record["sha256"] in seen_hashes:
                record["duplicate"] = True
                attempts.append(record)
                continue
            seen_hashes.add(str(record["sha256"]))
            filename = attachment_filename(response.headers, response.url, index)
            path = DOWNLOADS / f"{index:02d}-{filename}"
            path.write_bytes(response.content)
            record["saved_as"] = str(path)

            try:
                with zipfile.ZipFile(path) as archive:
                    names = archive.namelist()
                    record["zip_entries"] = len(names)
                    record["has_level_init"] = any(name.endswith("/level-init.dat") for name in names)
                    record["has_script_dat"] = any(name.endswith("/script.dat") for name in names)
                    record["has_level_chunks"] = any("/level.dat" in name for name in names)
                    record["valid_factorio_save"] = bool(
                        record["has_level_init"]
                        and record["has_script_dat"]
                        and record["has_level_chunks"]
                    )
                    if record["valid_factorio_save"]:
                        valid_saves.append(str(path))
            except Exception as exc:
                record["zip_error"] = repr(exc)
        except Exception as exc:
            record["error"] = repr(exc)
        attempts.append(record)

    summary = {
        "note_key": NOTE_KEY,
        "article_url": ARTICLE_URL,
        "api_url": API_URL,
        "fetches": records,
        "candidate_key_count": len(keys),
        "candidate_url_count": len(likely_urls),
        "valid_factorio_saves": valid_saves,
        "attempts": attempts,
    }
    (OUT / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not valid_saves:
        raise SystemExit("No valid Factorio save attachment found")


if __name__ == "__main__":
    main()
