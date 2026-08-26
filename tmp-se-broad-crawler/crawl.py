from __future__ import annotations

import concurrent.futures
import hashlib
import html
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
import zipfile
from collections import deque
from dataclasses import dataclass, asdict
from urllib.parse import parse_qs, quote, quote_plus, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

OUT = pathlib.Path("se-broad-work")
RAW = OUT / "raw"
DOWNLOADS = OUT / "downloads"
SAVES = OUT / "saves"
CANDIDATES = OUT / "candidate-saves"
for p in (OUT, RAW, DOWNLOADS, SAVES, CANDIDATES):
    p.mkdir(parents=True, exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/127 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
})

URL_RX = re.compile(r"https?://[^\s<>\"'\\]+", re.I)
DRIVE_RX = re.compile(r"(?:drive\.google\.com/(?:file/d/|open\?id=)|drive\.usercontent\.google\.com/download\?id=)([-\w]{20,})", re.I)
DISC_RX = re.compile(r"https?://mods\.factorio\.com/mod/[^/\s]+/discussion/[0-9a-f]{16,}", re.I)
FORUM_RX = re.compile(r"https?://forums\.factorio\.com/(?:viewtopic\.php\?[^\s<>\"']+|download/file\.php\?[^\s<>\"']+)", re.I)
SAVE_CONTEXT_RX = re.compile(r"(?i)(space[ -]?exploration|\bSE\b|0\.7\.[0-9]+|rocket science|rocket-science|cargo rocket|nauvis orbit|save(?:game| file)?|autosave|migration|desync|crash)")
FILEISH_RX = re.compile(r"(?i)(\.zip(?:$|[?#])|\.sav(?:$|[?#])|drive\.google|drive\.usercontent|dropbox\.com|gofile\.io|mediafire\.com|mega\.(?:nz|io)|pixeldrain\.com|catbox\.moe|discord(?:app)?\.com/(?:attachments|api/attachments)|cdn\.discordapp\.com/attachments|user-attachments/files|download/file\.php|archive\.org/download|1drv\.ms|onedrive\.live)")
EXCLUDED_RX = re.compile(r"(?i)(boobers[-_ ]?SE|sandbox_not_opening)")
VERSION_RX = re.compile(rb"\b0\.[67]\.[0-9]{1,3}\b")

SEARCH_QUERIES = [
    '"Space Exploration 0.7" "drive.google.com/file/d/" Factorio',
    '"Space Exploration 0.7" save zip Factorio',
    '"space-exploration_0.7" save',
    '"SE 0.7" Factorio "save file"',
    '"SE 0.7" Factorio savegame download',
    '"Nauvis Orbit" "save file" Factorio',
    '"rocket science" "Nauvis Orbit" Factorio save',
    '"cargo rocket" "save file" "Space Exploration"',
    '"Space Exploration" "gofile.io" Factorio',
    '"Space Exploration" "pixeldrain.com" Factorio save',
    '"Space Exploration" "dropbox.com" Factorio save',
    'site:mods.factorio.com/mod/*/discussion "Space Exploration" "save"',
    'site:mods.factorio.com/mod/*/discussion "SE 0.7"',
    'site:mods.factorio.com/mod/*/discussion "drive.google.com/file/d/" Factorio',
    'site:forums.factorio.com "Space Exploration 0.7" save',
    'site:forums.factorio.com "Nauvis Orbit" save',
    'site:reddit.com/r/factorio "SE 0.7" save',
    'site:reddit.com/r/factorio "Space Exploration 0.7" download',
    '"Space Exploration 0.7" セーブ Factorio',
    '"Space Exploration 0.7" 保存 Factorio',
    '"Space Exploration 0.7" 存档 Factorio',
    '"Space Exploration 0.7" сохранение Factorio',
    '"Space Exploration 0.7" sauvegarde Factorio',
    '"Space Exploration 0.7" Spielstand Factorio',
    '"Space Exploration 0.7" zapis gry Factorio',
    '"Space Exploration 0.7" save game reddit',
    '"space-exploration" "0.7.33" save Factorio',
    '"space-exploration" "0.7.34" save Factorio',
    '"space-exploration" "0.7.5" save Factorio',
    '"space-exploration" "0.7.6" save Factorio',
]

MODS = [
    "space-exploration", "factoryplanner", "FactorySearch", "RateCalculator", "Milestones",
    "FilterHelper", "ModuleInserterEx", "ModuleInserter", "even-distribution", "AutoDeconstruct",
    "Bottleneck", "BottleneckLite", "helmod", "RecipeBook", "RecipeBookClassic", "informatron",
    "Todo-List", "solar-calc", "YARM", "resource-monitor-mod", "dqol-resource-monitor",
    "FactorySearch", "belt-visualizer", "inserter-throughput", "pump", "mining-patch-planner",
    "aai-signal-transmission", "aai-containers", "aai-loaders", "jetpack", "robot_attrition",
    "shield-projector", "Warehousing", "textplates", "Squeak Through", "squeak-through-2",
    "PickerDollies", "even-pickier-dollies", "VehicleSnap", "LTN", "LogisticTrainNetwork",
    "cybersyn", "ProjectCybersyn", "flib", "stdlib", "Kux-CoreLib", "Kux-Modifications",
    "StatsGui", "TaskList", "QuickItemSearch", "BlueprintTools", "EditorExtensions",
    "CreativeMod", "FactoryPlanner", "FNEI", "What-is-it-really-used-for", "WireShortcuts",
    "Automatic_Train_Painter", "Train_Control_Signals", "miniloader-redux", "miniloader",
    "factorissimo-2-notnotmelon", "factorissimo-2", "ModuleInserterSimplified", "P.U.M.P.",
]

errors: list[dict] = []
source_pages: dict[str, dict] = {}
found_links: dict[str, dict] = {}


def get(url: str, timeout: int = 40, binary: bool = False) -> tuple[int | None, bytes | str, str | None, dict]:
    last: str | None = None
    for attempt in range(3):
        try:
            r = SESSION.get(url, timeout=timeout, allow_redirects=True)
            meta = {"status": r.status_code, "headers": dict(r.headers), "final_url": r.url}
            if r.status_code == 200:
                return r.status_code, (r.content if binary else r.text), r.url, meta
            last = f"HTTP {r.status_code}"
            if r.status_code in (400, 401, 403, 404, 410):
                break
        except Exception as exc:
            last = repr(exc)
        time.sleep(0.8 * (attempt + 1))
    return None, (b"" if binary else (last or "unknown error")), None, {"error": last}


def clean_url(raw: str) -> str:
    u = html.unescape(raw).replace("\\u0026", "&").rstrip(".,;:!?)\]}>'\"")
    # Decode common search-engine redirect wrappers.
    try:
        p = urlparse(u)
        q = parse_qs(p.query)
        for key in ("uddg", "url", "u", "q", "target"):
            if key in q and q[key]:
                candidate = unquote(q[key][0])
                if candidate.startswith("http"):
                    u = candidate
                    break
    except Exception:
        pass
    return u.split("#", 1)[0]


def add_link(url: str, source: str, context: str = "") -> None:
    url = clean_url(url)
    if not url.startswith("http") or EXCLUDED_RX.search(url + " " + context):
        return
    rec = found_links.setdefault(url, {"url": url, "sources": [], "contexts": []})
    if source not in rec["sources"]:
        rec["sources"].append(source)
    if context:
        compact = re.sub(r"\s+", " ", context).strip()[:2000]
        if compact and compact not in rec["contexts"]:
            rec["contexts"].append(compact)


def extract_links(text: str, base_url: str, source: str) -> set[str]:
    out: set[str] = set()
    soup = BeautifulSoup(text, "lxml")
    plain = soup.get_text("\n", strip=True)
    for a in soup.find_all("a", href=True):
        u = clean_url(urljoin(base_url, a["href"]))
        out.add(u)
        ctx = a.get_text(" ", strip=True)
        parent = a.parent.get_text(" ", strip=True) if a.parent else ""
        add_link(u, source, (ctx + " " + parent)[:2000])
    for raw in URL_RX.findall(text):
        u = clean_url(raw)
        out.add(u)
        at = text.find(raw)
        add_link(u, source, text[max(0, at - 500): at + len(raw) + 500])
    for rx in (DISC_RX, FORUM_RX):
        for m in rx.finditer(text):
            u = clean_url(m.group(0))
            out.add(u)
            add_link(u, source, plain[:1200])
    return out


def save_page(tag: str, url: str, text: str) -> None:
    h = hashlib.sha256(url.encode()).hexdigest()[:16]
    path = RAW / f"{tag}_{h}.html"
    path.write_text(text, encoding="utf-8", errors="replace")


def fetch_page(url: str, tag: str, retain: bool = False) -> dict:
    status, text, final, meta = get(url)
    if status != 200 or not isinstance(text, str):
        errors.append({"stage": tag, "url": url, "error": text, "meta": meta})
        return {"url": url, "status": status, "error": str(text)}
    links = extract_links(text, final or url, final or url)
    soup = BeautifulSoup(text, "lxml")
    plain = soup.get_text("\n", strip=True)
    rec = {
        "url": final or url,
        "status": 200,
        "title": soup.title.get_text(" ", strip=True) if soup.title else "",
        "text": plain[:30000],
        "links": sorted(links),
    }
    source_pages[rec["url"]] = rec
    if retain or SAVE_CONTEXT_RX.search(plain) or any(FILEISH_RX.search(u) for u in links):
        save_page(tag, rec["url"], text)
    return rec


def crawl_searches() -> None:
    for qi, query in enumerate(SEARCH_QUERIES):
        endpoints = [
            ("bingrss", "https://www.bing.com/search?format=rss&q=" + quote_plus(query)),
            ("bing", "https://www.bing.com/search?q=" + quote_plus(query) + "&count=50"),
            ("ddg", "https://html.duckduckgo.com/html/?q=" + quote_plus(query)),
            ("jina", "https://s.jina.ai/" + quote(query, safe="")),
            ("mojeek", "https://www.mojeek.com/search?q=" + quote_plus(query)),
        ]
        for tag, endpoint in endpoints:
            rec = fetch_page(endpoint, f"search_{qi}_{tag}", retain=False)
            # Search markdown and RSS often expose naked URLs inside text values.
            for u in rec.get("links", []):
                add_link(u, endpoint, query)
        print(f"search {qi + 1}/{len(SEARCH_QUERIES)} links={len(found_links)}", flush=True)


def crawl_mod_portal() -> None:
    thread_urls: set[str] = {u for u in found_links if DISC_RX.search(u)}
    title_words = re.compile(r"(?i)(space|explor|save|load|crash|error|bug|migration|desync|script|map|surface|rocket|orbit|satellite|factorissimo|module|recipe|planner|search|freeze|hang)")
    for mi, mod in enumerate(dict.fromkeys(MODS)):
        seen: set[str] = set()
        empty = 0
        for page in range(1, 13):
            url = f"https://mods.factorio.com/mod/{quote(mod, safe='')}/discussion" + ("" if page == 1 else f"?page={page}")
            status, text, final, meta = get(url)
            if status != 200 or not isinstance(text, str):
                if page == 1:
                    errors.append({"stage": "mod-list", "url": url, "error": text, "meta": meta})
                break
            soup = BeautifulSoup(text, "lxml")
            page_threads: set[str] = set()
            for a in soup.select('a[href*="/discussion/"]'):
                href = a.get("href")
                if not href:
                    continue
                u = clean_url(urljoin(final or url, href))
                if not DISC_RX.search(u):
                    continue
                text_near = a.parent.get_text(" ", strip=True) if a.parent else a.get_text(" ", strip=True)
                if title_words.search(text_near) or page <= 3:
                    page_threads.add(u)
            new = page_threads - seen
            if not new:
                empty += 1
            else:
                empty = 0
                seen.update(new)
                thread_urls.update(new)
            if empty >= 2:
                break
        print(f"mod {mi + 1}/{len(dict.fromkeys(MODS))} threads={len(thread_urls)}", flush=True)

    # Hard cap avoids a portal-wide denial-of-service by accidental enthusiasm.
    thread_list = sorted(thread_urls)[:1800]
    def one(u: str) -> dict:
        return fetch_page(u, "modthread", retain=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for i, rec in enumerate(ex.map(one, thread_list), 1):
            if i % 100 == 0:
                print(f"mod threads {i}/{len(thread_list)} filelinks={sum(bool(FILEISH_RX.search(x)) for x in found_links)}", flush=True)


def crawl_factorio_forums() -> None:
    urls: set[str] = {u for u in found_links if "forums.factorio.com/" in u}
    keywords = [
        '"Space Exploration" 0.7 save', '"Space Exploration" save file', '"Nauvis Orbit"',
        '"space-exploration" 0.7', '"rocket science" "Space Exploration"',
    ]
    for kw in keywords:
        for start in (0, 25, 50, 75):
            url = "https://forums.factorio.com/search.php?keywords=" + quote_plus(kw) + f"&start={start}"
            rec = fetch_page(url, "forumsearch", retain=False)
            urls.update(u for u in rec.get("links", []) if "forums.factorio.com/" in u)
    topic_urls = sorted(u for u in urls if "viewtopic.php" in u)[:700]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for i, _ in enumerate(ex.map(lambda u: fetch_page(u, "forumtopic", retain=False), topic_urls), 1):
            if i % 100 == 0:
                print(f"forum topics {i}/{len(topic_urls)}", flush=True)


def crawl_reddit_indexes() -> None:
    terms = [
        "space exploration 0.7 save", "SE 0.7 save", "space exploration save download",
        "Nauvis Orbit save", "rocket science save", "cargo rocket save",
    ]
    for term in terms:
        urls = [
            "https://api.pullpush.io/reddit/search/submission/?size=100&subreddit=factorio&q=" + quote_plus(term),
            "https://api.pullpush.io/reddit/search/comment/?size=100&subreddit=factorio&q=" + quote_plus(term),
            "https://www.reddit.com/r/factorio/search.json?restrict_sr=1&limit=100&sort=new&q=" + quote_plus(term),
        ]
        for url in urls:
            status, text, final, meta = get(url)
            if status != 200 or not isinstance(text, str):
                errors.append({"stage": "reddit", "url": url, "error": text, "meta": meta})
                continue
            extract_links(text, final or url, final or url)
            if "space" in text.lower() and ("save" in text.lower() or "drive.google" in text.lower()):
                save_page("reddit", final or url, text)


def crawl_candidate_pages() -> None:
    # Fetch externally discovered pages that may contain the real download one click deeper.
    skip_hosts = {"www.bing.com", "html.duckduckgo.com", "www.mojeek.com", "s.jina.ai", "google.com", "www.google.com"}
    page_urls = []
    for u, rec in list(found_links.items()):
        p = urlparse(u)
        if p.netloc.lower() in skip_hosts or FILEISH_RX.search(u):
            continue
        if any(x in p.netloc.lower() for x in ("factorio.com", "reddit.com", "github.com", "steamcommunity.com", "note.com", "pastebin.com", "gist.github.com")):
            if SAVE_CONTEXT_RX.search(" ".join(rec.get("contexts", [])) + " " + u):
                page_urls.append(u)
    page_urls = list(dict.fromkeys(page_urls))[:900]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for i, _ in enumerate(ex.map(lambda u: fetch_page(u, "candidatepage", retain=False), page_urls), 1):
            if i % 100 == 0:
                print(f"candidate pages {i}/{len(page_urls)}", flush=True)


def drive_id(url: str) -> str | None:
    m = DRIVE_RX.search(url)
    return m.group(1) if m else None


def mediafire_direct(page_text: str, base: str) -> str | None:
    soup = BeautifulSoup(page_text, "lxml")
    a = soup.select_one("a#downloadButton")
    if a and a.get("href"):
        return urljoin(base, a["href"])
    m = re.search(r'https?://download[^\"\']+mediafire\.com/[^\"\']+', page_text)
    return html.unescape(m.group(0)) if m else None


def gofile_links(url: str) -> list[str]:
    p = urlparse(url)
    seg = [x for x in p.path.split("/") if x]
    if not seg:
        return []
    cid = seg[-1]
    apis = [
        f"https://api.gofile.io/contents/{cid}?wt=4fd6sg89d7s6",
        f"https://api.gofile.io/getContent?contentId={cid}&token=",
    ]
    out: list[str] = []
    for api in apis:
        status, text, final, meta = get(api)
        if status != 200 or not isinstance(text, str):
            continue
        try:
            obj = json.loads(text)
        except Exception:
            continue
        def walk(v):
            if isinstance(v, dict):
                for k, x in v.items():
                    if k in ("link", "downloadPage", "directLink") and isinstance(x, str) and x.startswith("http"):
                        out.append(x)
                    walk(x)
            elif isinstance(v, list):
                for x in v:
                    walk(x)
        walk(obj)
    return list(dict.fromkeys(out))


@dataclass
class DownloadRec:
    source_url: str
    final_url: str
    path: str
    size: int
    sha256: str
    content_type: str
    context: str
    error: str = ""


def candidate_file_urls() -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for u, rec in found_links.items():
        ctx = " | ".join(rec.get("contexts", []))[:5000]
        if FILEISH_RX.search(u) and (SAVE_CONTEXT_RX.search(ctx + " " + u) or "user-attachments/files" in u or "download/file.php" in u):
            items.append((u, ctx))
    # Add direct links found on file-host landing pages.
    expanded: list[tuple[str, str]] = []
    for u, ctx in items[:500]:
        expanded.append((u, ctx))
        if "gofile.io/" in u:
            expanded.extend((x, ctx + " [gofile]") for x in gofile_links(u))
        elif "mediafire.com/" in u and "/file/" in u:
            status, text, final, meta = get(u)
            if status == 200 and isinstance(text, str):
                d = mediafire_direct(text, final or u)
                if d:
                    expanded.append((d, ctx + " [mediafire]") )
    # One URL per Drive file ID.
    seen_drive: set[str] = set(); out: list[tuple[str, str]] = []
    for u, ctx in expanded:
        did = drive_id(u)
        key = "drive:" + did if did else clean_url(u)
        if key in seen_drive:
            continue
        seen_drive.add(key)
        out.append((u, ctx))
    return out[:420]


def download_one(item: tuple[str, str]) -> DownloadRec:
    url, ctx = item
    if EXCLUDED_RX.search(url + " " + ctx):
        return DownloadRec(url, "", "", 0, "", "", ctx, "excluded")
    did = drive_id(url)
    idx = hashlib.sha256((url + ctx).encode()).hexdigest()[:16]
    base_path = DOWNLOADS / idx
    try:
        if did:
            out = str(base_path) + ".bin"
            proc = subprocess.run([sys.executable, "-m", "gdown", did, "-O", out], capture_output=True, text=True, timeout=1200)
            if proc.returncode != 0 or not pathlib.Path(out).exists():
                return DownloadRec(url, "", "", 0, "", "", ctx, "gdown: " + (proc.stderr or proc.stdout)[-1500:])
            path = pathlib.Path(out)
            final = url
            ctype = "application/octet-stream"
        else:
            direct = url
            if "dropbox.com/" in direct:
                direct = re.sub(r"[?&]dl=0", "?dl=1", direct)
                if "dl=1" not in direct:
                    direct += ("&" if "?" in direct else "?") + "dl=1"
            if "pixeldrain.com/u/" in direct:
                direct = direct.replace("pixeldrain.com/u/", "pixeldrain.com/api/file/")
            r = SESSION.get(direct, stream=True, timeout=90, allow_redirects=True)
            if r.status_code != 200:
                return DownloadRec(url, r.url, "", 0, "", r.headers.get("content-type", ""), ctx, f"HTTP {r.status_code}")
            length = int(r.headers.get("content-length") or 0)
            if length > 650_000_000:
                return DownloadRec(url, r.url, "", length, "", r.headers.get("content-type", ""), ctx, "too_large")
            disp = r.headers.get("content-disposition", "")
            ext = ".zip" if ("zip" in r.headers.get("content-type", "").lower() or ".zip" in r.url.lower() or ".zip" in disp.lower()) else ".bin"
            path = pathlib.Path(str(base_path) + ext)
            h = hashlib.sha256(); size = 0
            with path.open("wb") as f:
                for chunk in r.iter_content(1024 * 1024):
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > 650_000_000:
                        raise RuntimeError("stream too large")
                    h.update(chunk); f.write(chunk)
            final = r.url; ctype = r.headers.get("content-type", "")
            return DownloadRec(url, final, str(path), size, h.hexdigest(), ctype, ctx)
        size = path.stat().st_size
        if size > 650_000_000:
            path.unlink(missing_ok=True)
            return DownloadRec(url, final, "", size, "", ctype, ctx, "too_large")
        return DownloadRec(url, final, str(path), size, hashlib.sha256(path.read_bytes()).hexdigest(), ctype, ctx)
    except Exception as exc:
        return DownloadRec(url, "", "", 0, "", "", ctx, repr(exc))


def download_files() -> list[DownloadRec]:
    items = candidate_file_urls()
    (OUT / "candidate-file-urls.json").write_text(json.dumps([{"url": u, "context": c} for u, c in items], indent=2, ensure_ascii=False))
    recs: list[DownloadRec] = []
    # Conservative concurrency because file hosts enjoy banning useful behavior.
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(download_one, item): item for item in items}
        for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
            rec = fut.result(); recs.append(rec)
            print(f"download {i}/{len(items)} size={rec.size} err={rec.error[:80]} url={rec.source_url[:100]}", flush=True)
    (OUT / "downloads.json").write_text(json.dumps([asdict(x) for x in recs], indent=2, ensure_ascii=False))
    return recs


def save_roots(names: list[str]) -> list[str]:
    files = {n.rstrip("/") for n in names if not n.endswith("/")}
    roots = []
    for n in files:
        if not n.endswith("/level-init.dat"):
            continue
        r = n[:-len("/level-init.dat")]
        if f"{r}/script.dat" not in files:
            continue
        if not any(x == f"{r}/level.dat" or x.startswith(f"{r}/level.dat") for x in files):
            continue
        roots.append(r)
    return sorted(set(roots))


def printable_strings(data: bytes, min_len: int = 4) -> list[str]:
    return [m.group(0).decode("latin1", "replace") for m in re.finditer(rb"[\x20-\x7e]{%d,}" % min_len, data)]


def nearby_versions(strings: list[str]) -> tuple[list[str], list[str]]:
    se_versions: set[str] = set(); all_versions: set[str] = set()
    for i, s in enumerate(strings):
        for v in re.findall(r"\b0\.[67]\.\d{1,3}\b", s):
            all_versions.add(v)
        if "space-exploration" in s.lower():
            for x in strings[max(0, i - 20): i + 21]:
                for v in re.findall(r"\b0\.[67]\.\d{1,3}\b", x):
                    se_versions.add(v)
    return sorted(se_versions), sorted(all_versions)


def repack(zf: zipfile.ZipFile, root: str) -> bytes:
    out = io.BytesIO(); prefix = root + "/"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=5) as dest:
        for info in zf.infolist():
            if info.is_dir() or not info.filename.startswith(prefix):
                continue
            dest.writestr(info.filename, zf.read(info))
    return out.getvalue()


def inspect_archives(downloads: list[DownloadRec]) -> list[dict]:
    queue = deque()
    for d in downloads:
        if d.path and not d.error and pathlib.Path(d.path).exists():
            queue.append((d.source_url, d.context, pathlib.Path(d.path).name, 0, pathlib.Path(d.path).read_bytes()))
    seen: set[str] = set(); findings: list[dict] = []; nested_total = 0
    while queue:
        source, context, lineage, depth, blob = queue.popleft()
        sha = hashlib.sha256(blob).hexdigest()
        if sha in seen:
            continue
        seen.add(sha)
        bio = io.BytesIO(blob)
        if not zipfile.is_zipfile(bio):
            continue
        try:
            with zipfile.ZipFile(bio) as zf:
                names = zf.namelist(); roots = save_roots(names)
                for ri, root in enumerate(roots, 1):
                    level_init = zf.read(root + "/level-init.dat")
                    script = zf.read(root + "/script.dat")
                    strings = printable_strings(level_init)
                    se_versions, all_versions = nearby_versions(strings)
                    has_se = any("space-exploration" in s.lower() for s in strings) or b"space-exploration" in level_init.lower()
                    raw_versions = sorted({m.group(0).decode() for m in VERSION_RX.finditer(level_init)})
                    script_terms = {}
                    lower_script = script.lower()
                    for term in [b"se-rocket-science-pack", b"nauvis orbit", b"se-rocket-launch-pad", b"cargo rocket", b"satellite", b"space-science-pack", b"astronomic-science", b"cryonite", b"vulcanite", b"holmium", b"iridium", b"naquium"]:
                        script_terms[term.decode()] = lower_script.count(term)
                    native07 = has_se and (any(v.startswith("0.7.") for v in se_versions) or (any(v.startswith("0.7.") for v in raw_versions) and not any(v.startswith("0.6.") for v in se_versions)))
                    save_blob = blob if len(roots) == 1 and all(n == root or n.startswith(root + "/") for n in names) else repack(zf, root)
                    ssha = hashlib.sha256(save_blob).hexdigest()
                    save_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", pathlib.PurePosixPath(root).name)[:80] + "__" + ssha[:12] + ".zip"
                    save_path = SAVES / save_name
                    save_path.write_bytes(save_blob)
                    rec = {
                        "source_url": source, "context": context, "lineage": lineage, "depth": depth,
                        "root": root, "save_path": str(save_path), "size": len(save_blob), "sha256": ssha,
                        "has_space_exploration": has_se, "se_versions_near_name": se_versions,
                        "all_06_07_versions": sorted(set(all_versions + raw_versions)), "native_se_0_7_likely": native07,
                        "script_terms": script_terms,
                    }
                    findings.append(rec)
                    if native07 and len(save_blob) < 94_000_000 and not EXCLUDED_RX.search(root + " " + context):
                        (CANDIDATES / save_name).write_bytes(save_blob)
                if depth < 5:
                    for info in zf.infolist():
                        low = info.filename.lower()
                        if info.is_dir() or info.file_size <= 0 or info.file_size > 650_000_000:
                            continue
                        if not low.endswith((".zip", ".sav")):
                            continue
                        if nested_total + info.file_size > 4_000_000_000:
                            continue
                        data = zf.read(info); nested_total += len(data)
                        queue.append((source, context, lineage + " -> " + info.filename, depth + 1, data))
        except Exception as exc:
            errors.append({"stage": "zip-inspect", "source": source, "lineage": lineage, "error": repr(exc)})
    (OUT / "saves.json").write_text(json.dumps(findings, indent=2, ensure_ascii=False))
    return findings


def publish_summary(downloads: list[DownloadRec], saves: list[dict]) -> None:
    native = [s for s in saves if s.get("native_se_0_7_likely")]
    file_links = [r for r in found_links.values() if FILEISH_RX.search(r["url"])]
    (OUT / "source-pages.json").write_text(json.dumps(source_pages, indent=2, ensure_ascii=False))
    (OUT / "all-links.json").write_text(json.dumps(list(found_links.values()), indent=2, ensure_ascii=False))
    (OUT / "file-links.json").write_text(json.dumps(file_links, indent=2, ensure_ascii=False))
    (OUT / "errors.json").write_text(json.dumps(errors, indent=2, ensure_ascii=False))
    lines = [
        "# Broad Space Exploration 0.7 save crawl",
        "",
        f"Search queries: {len(SEARCH_QUERIES)}",
        f"Source pages retained: {len(source_pages)}",
        f"Unique links found: {len(found_links)}",
        f"File-host/download links: {len(file_links)}",
        f"Downloads attempted: {len(downloads)}",
        f"Successful nonempty downloads: {sum(bool(d.path and not d.error and d.size) for d in downloads)}",
        f"Factorio saves extracted: {len(saves)}",
        f"Likely native SE 0.7 saves: {len(native)}",
        "",
        "## Likely native SE 0.7 saves",
        "",
    ]
    for s in native:
        lines += [
            f"### {s['root']}",
            f"- Source: {s['source_url']}",
            f"- Context: {s['context'][:1500]}",
            f"- Size: {s['size']}",
            f"- SHA-256: `{s['sha256']}`",
            f"- SE versions near mod name: {', '.join(s['se_versions_near_name']) or '(none)'}",
            f"- All 0.6/0.7 strings: {', '.join(s['all_06_07_versions']) or '(none)'}",
            f"- Script terms: `{json.dumps(s['script_terms'], sort_keys=True)}`",
            "",
        ]
    lines += ["## All extracted Factorio saves", ""]
    for s in saves:
        lines.append(f"- `{s['root']}` | SE={s['has_space_exploration']} | likely07={s['native_se_0_7_likely']} | {s['source_url']}")
    (OUT / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:400]), flush=True)


def main() -> None:
    started = time.time()
    crawl_searches()
    crawl_mod_portal()
    crawl_factorio_forums()
    crawl_reddit_indexes()
    crawl_candidate_pages()
    downloads = download_files()
    saves = inspect_archives(downloads)
    publish_summary(downloads, saves)
    (OUT / "elapsed.txt").write_text(f"{time.time() - started:.1f}\n")


if __name__ == "__main__":
    main()
