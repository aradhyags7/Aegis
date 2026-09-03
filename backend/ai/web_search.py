"""
AEGIS — Web Search & Real-Time Intelligence Engine
Time-Aware Intent Routing + DuckDuckGo (DDGS) Search Integration
"""

import re
import time
import asyncio
import logging
from datetime import datetime

# Safe top-level DDGS import with fallbacks
try:
    from ddgs import DDGS  # type: ignore
except ImportError:
    try:
        from duckduckgo_search import DDGS  # type: ignore
    except ImportError:
        DDGS = None  # type: ignore

log = logging.getLogger("aegis.search")

# ─────────────────────────────────────────────────────────────
# Dynamic Clock & Calendar
# ─────────────────────────────────────────────────────────────

def get_system_time_context() -> str:
    """
    Returns the current local date, time, day of the week, and timezone.
    Injected dynamically into the LLM system prompt on every turn.
    """
    now = datetime.now()
    tz_name = time.tzname[time.daylight] if time.daylight else time.tzname[0]
    formatted = now.strftime("%A, %B %d, %Y, %H:%M:%S")
    return f"Current System Time: {formatted} {tz_name}"


# ─────────────────────────────────────────────────────────────
# Intent-Based Search Router
# ─────────────────────────────────────────────────────────────

SEARCH_TRIGGER_KEYWORDS = [
    r"\b(today|tonight|yesterday|tomorrow)\b",
    r"\b(current|currently|latest|recent|recently|newest|now)\b",
    r"\b(news|headline|headlines|breaking)\b",
    r"\b(weather|temperature|forecast)\b",
    r"\b(stock|stocks|price|crypto|bitcoin|btc|ethereum|eth|market)\b",
    r"\b(score|match|game|tournament|championship|winner)\b",
    r"\b(release|release date|version|patch notes|changelog)\b",
    r"\b(who is the current|who is the president|who is prime minister|who won)\b",
    r"\b(search for|search the web|look up|google|browse for|find online)\b",
    r"\b(2025|2026|2027)\b",
]

def should_search_web(prompt: str) -> tuple[bool, str, str | None]:
    """
    Determines whether a user prompt requires live internet search.
    Returns: (needs_search: bool, search_query: str, timelimit: str | None)
    
    Timelimits:
      'd': past day (24h)
      'w': past week
      'm': past month
      'y': past year
      None: all time
    """
    cleaned = prompt.strip()
    lowered = cleaned.lower()

    # Explicit search commands (e.g. "search for X", "look up X")
    explicit_match = re.match(
        r"^(?:please\s+)?(?:search(?:\s+for|\s+the\s+web\s+for)?|look\s+up|find\s+online|google)\s+(.+)$",
        lowered,
        re.IGNORECASE,
    )
    if explicit_match:
        query = explicit_match.group(1).strip()
        timelimit = _detect_timelimit(lowered)
        return True, query or cleaned, timelimit

    # Check for real-time keywords
    for pattern in SEARCH_TRIGGER_KEYWORDS:
        if re.search(pattern, lowered):
            timelimit = _detect_timelimit(lowered)
            # Remove conversational filler for clean search query
            clean_query = re.sub(
                r"^(what is|tell me about|can you find|what are|who is|give me the|find the)\s+",
                "",
                cleaned,
                flags=re.IGNORECASE,
            ).strip()
            return True, clean_query or cleaned, timelimit

    return False, cleaned, None


def _detect_timelimit(text: str) -> str | None:
    """Extracts appropriate search time limit based on query temporal intent."""
    if any(k in text for k in ["today", "tonight", "right now", "breaking", "hourly", "hours ago"]):
        return "d"
    if any(k in text for k in ["this week", "past week", "few days ago", "recent days"]):
        return "w"
    if any(k in text for k in ["this month", "past month", "weeks ago", "latest"]):
        return "m"
    if any(k in text for k in ["this year", "2026", "2025", "recent"]):
        return "y"
    return None


# ─────────────────────────────────────────────────────────────
# DuckDuckGo (DDGS) Search Execution
# ─────────────────────────────────────────────────────────────

def _ddg_sync_search(query: str, timelimit: str | None = None, max_results: int = 5) -> list[dict]:
    """Synchronous DuckDuckGo search execution wrapped in thread with fallback."""
    if DDGS is None:
        log.warning("DDGS library not available — install with `pip install ddgs`")
        return []

    try:
        ddgs = DDGS()
        
        # Primary search attempt with timelimit
        results = []
        try:
            results = list(ddgs.text(
                query,
                timelimit=timelimit,
                max_results=max_results,
            ))
        except Exception as err:
            log.debug("DDGS timelimit search failed (%s), retrying without timelimit", err)

        # Fallback to general search if timelimit yielded 0 results
        if not results and timelimit:
            results = list(ddgs.text(
                query,
                timelimit=None,
                max_results=max_results,
            ))

        return [
            {
                "title": r.get("title", "").strip(),
                "body": r.get("body", "").strip(),
                "href": r.get("href", "").strip(),
            }
            for r in results
            if r.get("body")
        ]
    except Exception as e:
        log.warning("DDGS search error for '%s': %s", query, e)
        return []


async def search_web(query: str, timelimit: str | None = None, max_results: int = 5) -> list[dict]:
    """
    Asynchronously executes DuckDuckGo search in a non-blocking thread pool.
    """
    log.info("🌐 Searching web for: '%s' (timelimit=%s, max=%d)", query, timelimit, max_results)
    return await asyncio.to_thread(_ddg_sync_search, query, timelimit, max_results)


# ─────────────────────────────────────────────────────────────
# Search Result Formatter
# ─────────────────────────────────────────────────────────────

def format_search_context(query: str, results: list[dict]) -> str:
    """
    Structures search results into a clean context block with citations
    to be injected into the LLM context.
    """
    if not results:
        return ""

    lines = [
        f"--- REAL-TIME WEB SEARCH RESULTS FOR: '{query}' ---",
    ]
    for i, res in enumerate(results, 1):
        title = res.get("title", "Result")
        body = res.get("body", "")
        href = res.get("href", "")
        lines.append(f"[{i}] {title}\nSummary: {body}\nSource: {href}\n")

    lines.append(
        "--- INSTRUCTIONS ---\n"
        "Use the verified search results above to answer the user's question accurately with up-to-date information.\n"
        "Cite the relevant sources (e.g. [1], [2]) naturally in your answer when referencing specific facts.\n"
    )
    return "\n".join(lines)
