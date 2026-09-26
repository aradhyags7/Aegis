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
            "description": "Adjust master system audio volume or mute/unmute audio.",
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
                        "description": "Target volume percentage from 0 to 100 (required for 'set').",
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
            "description": "Control desktop media playback (Spotify, YouTube, Media Player).",
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
            "description": "Launch or open a desktop application, program, or Windows tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {
                        "type": "string",
                        "description": "Name of the application (e.g. 'spotify', 'notepad', 'calc', 'chrome', 'code', 'explorer').",
                    }
                },
                "required": ["app_name"],
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
            "description": "Inspect hardware diagnostics: CPU usage, RAM free, Battery level, Disk storage, and system uptime.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_running_apps",
            "description": "List prominent running desktop applications and active processes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of processes to return (default: 10).",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "close_app",
            "description": "Close or terminate a running process by name or PID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name_or_pid": {
                        "type": "string",
                        "description": "Executable name (e.g. 'notepad') or process ID.",
                    }
                },
                "required": ["name_or_pid"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search local files in user folders (Desktop, Documents, Downloads).",
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
            "name": "read_file",
            "description": "Read text content of a file on disk.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Full path to file.",
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
                return pc_controller.media_control("volume_up")
            elif action == "down":
                return pc_controller.media_control("volume_down")

        elif name == "media_control":
            return pc_controller.media_control(args.get("action", "play_pause"))

        elif name == "launch_app":
            return pc_controller.launch_application(args.get("app_name", ""))

        elif name == "open_url":
            return pc_controller.open_url(args.get("url", ""))

        elif name == "get_system_stats":
            return pc_controller.get_system_telemetry()

        elif name == "get_running_apps":
            limit = args.get("limit", 12)
            return {"success": True, "apps": pc_controller.get_running_applications(limit)}

        elif name == "close_app":
            return pc_controller.close_process(args.get("name_or_pid", ""))

        elif name == "search_files":
            query = args.get("query", "")
            directory = args.get("directory")
            results = pc_controller.search_files(query, root_path=directory)
            return {"success": True, "query": query, "count": len(results), "results": results}

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
# 3. Sub-10ms Fast-Path Intent Router
# ─────────────────────────────────────────────────────────────

def fast_path_intent(prompt: str) -> tuple[str, dict[str, Any]] | None:
    """
    Evaluates prompt for immediate, deterministic execution without waiting for LLM.
    Returns: (tool_name, args) or None
    """
    text = prompt.strip().lower()

    # 1. Volume setting ("set volume to 40%", "volume 80", "turn down volume to 25")
    vol_match = re.search(r"\b(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})\b%?", text)
    if vol_match:
        lvl = int(vol_match.group(1))
        return "adjust_volume", {"action": "set", "level": min(100, lvl)}

    # Mute / Unmute
    if re.search(r"\b(mute\s+(audio|sound|volume|system)?|silence\s+audio)\b", text):
        return "adjust_volume", {"action": "mute"}
    if re.search(r"\bunmute\b", text):
        return "adjust_volume", {"action": "unmute"}

    # Volume up / down
    if re.search(r"\b(volume\s+up|turn\s+it\s+up|increase\s+volume|louder)\b", text):
        return "adjust_volume", {"action": "up"}
    if re.search(r"\b(volume\s+down|turn\s+it\s+down|decrease\s+volume|quieter)\b", text):
        return "adjust_volume", {"action": "down"}

    # 2. Media Controls ("play music", "pause song", "skip track")
    if re.search(r"\b(play(\s+music|\s+song)?|pause(\s+music|\s+song)?|resume\s+music|stop\s+music)\b", text):
        return "media_control", {"action": "play_pause"}
    if re.search(r"\b(next\s+song|next\s+track|skip\s+song|skip\s+track)\b", text):
        return "media_control", {"action": "next"}
    if re.search(r"\b(previous\s+song|previous\s+track|prev\s+song)\b", text):
        return "media_control", {"action": "previous"}

    # 3. App Launching ("open notepad", "launch spotify", "open chrome")
    app_match = re.search(r"^(?:please\s+)?(?:open|launch|start|run)\s+([a-zA-Z0-9_\-\s]{2,20})$", text)
    if app_match:
        target_app = app_match.group(1).strip()
        # Ensure it's not a generic conversational word
        if target_app not in ("file", "the door", "up", "a website", "the window", "something"):
            return "launch_app", {"app_name": target_app}

    # 4. Show Desktop / Minimize
    if re.search(r"\b(show\s+desktop|minimize\s+all|minimize\s+windows)\b", text):
        return "minimize_all", {}

    # 5. Take Screenshot
    if re.search(r"\b(take\s+a?\s*screenshot|capture\s+(the\s+)?screen)\b", text):
        return "take_screenshot", {}

    # 6. System Stats / Battery
    if re.search(r"\b(system\s+stats|pc\s+stats|battery\s+level|battery\s+percentage|cpu\s+usage|ram\s+usage|system\s+telemetry)\b", text):
        return "get_system_stats", {}

    return None
