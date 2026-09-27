"""
AEGIS — Tool Registry, Function Calling Schemas & Fast-Path Intent Router
Bridges Ollama with the Native Windows PC Controller.
"""

import re
import json
import logging
from typing import Any

from ai import pc_controller

log = logging.getLogger("aegis.tools")

# ─────────────────────────────────────────────────────────────
# 1. Ollama-Compatible Tool Schemas (OpenAI Function Calling)
# ─────────────────────────────────────────────────────────────

AEGIS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "adjust_volume",
            "description": "Adjust master system audio volume, change volume relatively (+10% / -10%), or mute/unmute audio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["set", "mute", "unmute", "toggle_mute", "up", "down"],
                        "description": "Volume action to perform.",
                    },
                    "level": {
                        "type": "integer",
                        "description": "Target volume percentage from 0 to 100 (for 'set').",
                    },
                    "delta": {
                        "type": "integer",
                        "description": "Relative percentage delta (e.g. 10 for +10%, -10 for -10%).",
                    },
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "media_control",
            "description": "Control desktop media playback (Spotify, YouTube, VLC, Media Player).",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["play_pause", "next", "previous", "stop"],
                        "description": "Media command to execute.",
                    }
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "launch_app",
            "description": "Launch or open a desktop application, program, shortcut, or Windows tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {
                        "type": "string",
                        "description": "Name of the application (e.g. 'chrome', 'spotify', 'notepad', 'calc', 'code', 'discord', 'steam', 'vlc').",
                    }
                },
                "required": ["app_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "close_app",
            "description": "Close or terminate a running application or process tree by name or PID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name_or_pid": {
                        "type": "string",
                        "description": "Executable or application name (e.g. 'chrome', 'spotify', 'discord', 'notepad') or process ID.",
                    }
                },
                "required": ["name_or_pid"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "focus_window",
            "description": "Bring an open desktop window to the foreground by title or application name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Window title or application name to focus (e.g. 'chrome', 'spotify', 'visual studio code').",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "window_state",
            "description": "Control window display: maximize, minimize, restore, snap left, snap right, or close active window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["maximize", "minimize", "close", "snap_left", "snap_right"],
                        "description": "Window operation.",
                    },
                    "query": {
                        "type": "string",
                        "description": "Optional window title or application to target. If omitted, targets active window.",
                    },
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_open_windows",
            "description": "List all visible, titled desktop windows currently open on the user's screen.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of windows to return (default: 12).",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_url",
            "description": "Open a website URL in the user's default browser.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Web address to open (e.g. 'https://github.com').",
                    }
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_stats",
            "description": "Inspect real hardware diagnostics: CPU, RAM, Battery, Disk storage, GPU status, Network IP, and uptime.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clipboard_op",
            "description": "Read or write text to the Windows clipboard.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["get", "set"],
                        "description": "Clipboard action ('get' to read, 'set' to copy).",
                    },
                    "text": {
                        "type": "string",
                        "description": "Text to copy to clipboard (required if action is 'set').",
                    },
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search local files in user folders (Desktop, Documents, Downloads, Codebase).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Filename, keyword, or extension to search for.",
                    },
                    "directory": {
                        "type": "string",
                        "description": "Optional root directory path to restrict search.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_path",
            "description": "Open a local file or folder in its default application or Explorer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File or directory path to open.",
                    }
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Capture a screenshot of the entire desktop screen.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "minimize_all",
            "description": "Minimize all windows and toggle desktop display (Win+D).",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a non-interactive PowerShell command in a safe environment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "PowerShell command string to run.",
                    }
                },
                "required": ["command"],
            },
        },
    },
]


# ─────────────────────────────────────────────────────────────
# 2. Tool Dispatcher
# ─────────────────────────────────────────────────────────────

def execute_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Dispatches a function call to the native PC Controller."""
    log.info("⚡ Executing PC tool '%s' with args: %s", name, args)

    try:
        if name == "adjust_volume":
            action = args.get("action", "set")
            if action == "set":
                level = args.get("level", 50)
                return pc_controller.set_volume(level)
            elif action in ("mute", "unmute", "toggle_mute"):
                mute_flag = True if action == "mute" else (False if action == "unmute" else None)
                return pc_controller.toggle_mute(mute_flag)
            elif action == "up":
                delta = args.get("delta", 10)
                return pc_controller.change_volume_relative(abs(delta))
            elif action == "down":
                delta = args.get("delta", 10)
                return pc_controller.change_volume_relative(-abs(delta))

        elif name == "media_control":
            return pc_controller.media_control(args.get("action", "play_pause"))

        elif name == "launch_app":
            return pc_controller.launch_application(args.get("app_name", ""))

        elif name == "close_app":
            return pc_controller.close_process(args.get("name_or_pid", ""))

        elif name == "focus_window":
            return pc_controller.focus_window(args.get("query", ""))

        elif name == "window_state":
            action = args.get("action", "maximize")
            query = args.get("query")
            if action == "maximize":
                return pc_controller.maximize_window(query)
            elif action == "minimize":
                return pc_controller.minimize_window(query)
            elif action == "close":
                return pc_controller.close_window(query)
            elif action == "snap_left":
                return pc_controller.snap_window("left")
            elif action == "snap_right":
                return pc_controller.snap_window("right")

        elif name == "get_open_windows":
            limit = args.get("limit", 12)
            wins = pc_controller.get_open_windows(limit)
            return {"success": True, "count": len(wins), "windows": wins}

        elif name == "open_url":
            return pc_controller.open_url(args.get("url", ""))

        elif name == "get_system_stats":
            return pc_controller.get_system_telemetry()

        elif name == "clipboard_op":
            action = args.get("action", "get")
            if action == "set":
                return pc_controller.set_clipboard_text(args.get("text", ""))
            return pc_controller.get_clipboard_text()

        elif name == "search_files":
            query = args.get("query", "")
            directory = args.get("directory")
            results = pc_controller.search_files(query, root_path=directory)
            return {"success": True, "query": query, "count": len(results), "results": results}

        elif name == "open_path":
            return pc_controller.open_path_in_shell(args.get("path", ""))

        elif name == "read_file":
            return pc_controller.read_file_snippet(args.get("path", ""))

        elif name == "take_screenshot":
            return pc_controller.capture_screenshot()

        elif name == "minimize_all":
            return pc_controller.minimize_all_windows()

        elif name == "run_command":
            return pc_controller.run_powershell(args.get("command", ""))

        return {"success": False, "error": f"Unknown tool: '{name}'"}
    except Exception as e:
        log.exception("Tool execution failed for '%s': %s", name, e)
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# 3. Sub-1ms Deterministic Fast-Path Intent Router
# ─────────────────────────────────────────────────────────────

def fast_path_intent(prompt: str) -> tuple[str, dict[str, Any]] | None:
    """
    Evaluates prompt for immediate, deterministic execution without waiting for LLM.
    Returns: (tool_name, args) or None
    """
    text = prompt.strip().lower()

    # 1. Volume setting ("set volume to 40%", "volume 80", "turn down volume to 25")
    vol_set_match = re.search(r"\b(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})\b%?", text)
    if vol_set_match:
        lvl = int(vol_set_match.group(1))
        return "adjust_volume", {"action": "set", "level": min(100, lvl)}

    # Relative Volume delta ("increase volume by 20", "turn up volume by 15%", "lower volume by 10")
    vol_rel_up = re.search(r"\b(?:turn\s+up|increase|raise)\s+volume\s+(?:by\s+)?(\d{1,2})\b%?", text)
    if vol_rel_up:
        return "adjust_volume", {"action": "up", "delta": int(vol_rel_up.group(1))}

    vol_rel_down = re.search(r"\b(?:turn\s+down|decrease|lower)\s+volume\s+(?:by\s+)?(\d{1,2})\b%?", text)
    if vol_rel_down:
        return "adjust_volume", {"action": "down", "delta": int(vol_rel_down.group(1))}

    # Mute / Unmute
    if re.search(r"\b(mute\s+(audio|sound|volume|system)?|silence\s+audio|mute)\b", text):
        return "adjust_volume", {"action": "mute"}
    if re.search(r"\bunmute(\s+(audio|sound|volume|system))?\b", text):
        return "adjust_volume", {"action": "unmute"}

    # General Volume up / down
    if re.search(r"\b(volume\s+up|turn\s+it\s+up|increase\s+volume|louder|make\s+it\s+louder)\b", text):
        return "adjust_volume", {"action": "up", "delta": 10}
    if re.search(r"\b(volume\s+down|turn\s+it\s+down|decrease\s+volume|quieter|make\s+it\s+quieter)\b", text):
        return "adjust_volume", {"action": "down", "delta": 10}

    # 2. Media Controls ("play music", "pause song", "skip track")
    if re.search(r"\b(play(\s+music|\s+song)?|pause(\s+music|\s+song)?|resume\s+music|stop\s+music)\b", text):
        return "media_control", {"action": "play_pause"}
    if re.search(r"\b(next\s+song|next\s+track|skip\s+song|skip\s+track|next)\b", text):
        return "media_control", {"action": "next"}
    if re.search(r"\b(previous\s+song|previous\s+track|prev\s+song|prev\s+track|last\s+song)\b", text):
        return "media_control", {"action": "previous"}

    # 3. App Closing ("close chrome", "exit discord", "kill notepad", "quit spotify", "shut down vscode")
    close_match = re.search(
        r"^(?:please\s+|can\s+you\s+)?(?:close|exit|quit|kill|terminate|shut\s+down)\s+(?:the\s+)?([a-zA-Z0-9_\-\s]{2,25})$",
        text,
    )
    if close_match:
        target_app = close_match.group(1).strip()
        # Disambiguate window vs app
        if target_app in ("window", "this window", "current window", "active window", "the window", "this"):
            return "window_state", {"action": "close"}
        if target_app not in ("file", "the door", "dialog", "down", "something"):
            return "close_app", {"name_or_pid": target_app}

    # 4. App Launching ("open notepad", "launch spotify", "open chrome", "start discord", "run code")
    app_match = re.search(
        r"^(?:please\s+|can\s+you\s+)?(?:open|launch|start|run)\s+(?:up\s+)?(?:my\s+)?([a-zA-Z0-9_\-\s]{2,25})$",
        text,
    )
    if app_match:
        target_app = app_match.group(1).strip()
        # Exclude non-app words
        if target_app in ("downloads", "desktop", "documents", "pictures", "videos", "music"):
            target_path = str(pc_controller.Path.home() / target_app.capitalize())
            return "open_path", {"path": target_path}
        if target_app not in ("file", "the door", "up", "a website", "the window", "something", "a tab", "new tab"):
            return "launch_app", {"app_name": target_app}

    # 5. Window Focus / Switching ("switch to chrome", "bring spotify to front", "focus vs code", "go to discord")
    focus_match = re.search(
        r"\b(?:switch\s+to|focus(?:\s+on)?|bring\s+(?:up\s+)?|go\s+to)\s+([a-zA-Z0-9_\-\s]{2,25})(?:\s+to\s+(?:the\s+)?front)?\b",
        text,
    )
    if focus_match:
        win_target = focus_match.group(1).strip()
        if win_target not in ("next", "previous", "sleep", "bed", "work", "it", "window"):
            return "focus_window", {"query": win_target}

    # 6. Window State (Maximize, Minimize, Snap, Desktop)
    if re.search(r"\b(maximize\s+(this\s+)?window|make\s+it\s+full\s*screen|maximize\s+this|maximize)\b", text):
        return "window_state", {"action": "maximize"}
    if re.search(r"\b(minimize\s+(this\s+)?window|minimize\s+this|minimize)\b", text):
        return "window_state", {"action": "minimize"}
    if re.search(r"\b(close\s+(this\s+|current\s+|active\s+)?window)\b", text):
        return "window_state", {"action": "close"}
    if re.search(r"\b(snap\s+(window\s+)?(?:to\s+(?:the\s+)?)?left)\b", text):
        return "window_state", {"action": "snap_left"}
    if re.search(r"\b(snap\s+(window\s+)?(?:to\s+(?:the\s+)?)?right)\b", text):
        return "window_state", {"action": "snap_right"}
    if re.search(r"\b(show\s+desktop|minimize\s+all|minimize\s+windows|hide\s+all\s+windows)\b", text):
        return "minimize_all", {}

    # Open / Active Windows Query
    if re.search(r"\b(what\s+windows\s+are\s+open|list\s+(open\s+)?windows|show\s+open\s+windows)\b", text):
        return "get_open_windows", {}

    # 7. Take Screenshot
    if re.search(r"\b(take\s+a?\s*screenshot|capture\s+(the\s+)?screen|screenshot\s+this)\b", text):
        return "take_screenshot", {}

    # 8. Clipboard operations
    if re.search(r"\b(what('s|\s+is)\s+(in|on)\s+my\s+clipboard|read\s+clipboard|get\s+clipboard|paste\s+clipboard)\b", text):
        return "clipboard_op", {"action": "get"}

    copy_match = re.search(r"^(?:please\s+)?copy\s+(?:\"([^\"]+)\"|'([^']+)'|(.+))\s+to\s+(?:the\s+)?clipboard$", text)
    if copy_match:
        copied_text = copy_match.group(1) or copy_match.group(2) or copy_match.group(3)
        if copied_text:
            return "clipboard_op", {"action": "set", "text": copied_text.strip()}

    # 9. System Diagnostics & Telemetry
    if re.search(r"\b(system\s+stats|pc\s+stats|system\s+status|system\s+telemetry|diagnostics|system\s+health)\b", text):
        return "get_system_stats", {}

    if re.search(r"\b(battery(\s+level|\s+percentage|\s+status)?|is\s+my\s+laptop\s+charging)\b", text):
        return "get_system_stats", {}

    if re.search(r"\b(cpu\s+usage|how\s+much\s+cpu|processor\s+usage)\b", text):
        return "get_system_stats", {}

    if re.search(r"\b(ram\s+usage|memory\s+usage|how\s+much\s+ram|free\s+memory|free\s+ram)\b", text):
        return "get_system_stats", {}

    if re.search(r"\b(disk\s+space|free\s+disk|storage\s+space|how\s+much\s+storage)\b", text):
        return "get_system_stats", {}

    if re.search(r"\b(what\s+gpu|graphics\s+card|gpu\s+usage|gpu\s+status)\b", text):
        return "get_system_stats", {}

    if re.search(r"\b(what\s+is\s+my\s+ip|local\s+ip|my\s+ip\s+address|network\s+status|hostname)\b", text):
        return "get_system_stats", {}

    # 10. File Search & Discovery
    search_file_match = re.search(
        r"\b(?:find|search\s+for|search\s+files\s+for|locate)\s+(?:(?:files?|documents?)\s+)?([a-zA-Z0-9_\-\.]{2,40})\b",
        text,
    )
    if search_file_match:
        file_query = search_file_match.group(1).strip()
        if file_query not in ("something", "anything", "me", "it", "my", "the", "a", "info", "information"):
            return "search_files", {"query": file_query}


    # Open folder
    if re.search(r"\bopen\s+(downloads|desktop|documents|pictures|videos|music)(\s+folder)?\b", text):
        folder_match = re.search(r"\b(downloads|desktop|documents|pictures|videos|music)\b", text)
        if folder_match:
            fpath = str(pc_controller.Path.home() / folder_match.group(1).capitalize())
            return "open_path", {"path": fpath}

    return None
