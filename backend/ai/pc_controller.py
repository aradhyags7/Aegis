"""
AEGIS — Native Windows PC Controller Engine
Provides execution primitives for audio/media, applications, processes,
system telemetry, window management, screen perception, and file system.
"""

import os
import sys
import time
import ctypes
import logging
import platform
import subprocess
import webbrowser
from pathlib import Path
from typing import Any

import psutil  # type: ignore

log = logging.getLogger("aegis.pc_controller")

# ─────────────────────────────────────────────────────────────
# 1. Audio & Media Subsystem (pycaw + Windows Virtual Keys)
# ─────────────────────────────────────────────────────────────

# Virtual Key Codes for Media & Volume
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_STOP = 0xB2
VK_MEDIA_PLAY_PAUSE = 0xB3
VK_LWIN = 0x5B
KEYEVENTF_KEYUP = 0x0002

def _send_virtual_key(vk_code: int):
    """Simulates pressing and releasing a virtual key in Windows."""
    try:
        user32 = ctypes.windll.user32
        user32.keybd_event(vk_code, 0, 0, 0)
        time.sleep(0.04)
        user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)
        return True
    except Exception as e:
        log.warning("Failed to send virtual key 0x%X: %s", vk_code, e)
        return False

def _get_audio_endpoint():
    """Initializes and returns the pycaw AudioEndpointVolume interface."""
    try:
        import comtypes  # type: ignore
        comtypes.CoInitialize()
        from pycaw.pycaw import AudioUtilities  # type: ignore
        speakers = AudioUtilities.GetSpeakers()
        if not speakers:
            return None
        if hasattr(speakers, "EndpointVolume"):
            return speakers.EndpointVolume
        return None
    except Exception as e:
        log.debug("pycaw initialization failed: %s", e)
        return None

def get_volume() -> dict[str, Any]:
    """Retrieves current master volume level (0-100) and mute status."""
    volume = _get_audio_endpoint()
    if volume:
        try:
            current = round(volume.GetMasterVolumeLevelScalar() * 100)
            muted = bool(volume.GetMute())
            return {"success": True, "volume": current, "muted": muted}
        except Exception as e:
            log.warning("Could not read volume via pycaw: %s", e)
    return {"success": False, "error": "Audio device unavailable", "volume": None, "muted": None}

def set_volume(level: int) -> dict[str, Any]:
    """Sets master volume level (0-100%)."""
    clamped = max(0, min(100, int(level)))
    volume = _get_audio_endpoint()
    if volume:
        try:
            scalar = clamped / 100.0
            volume.SetMasterVolumeLevelScalar(scalar, None)
            if volume.GetMute():
                volume.SetMute(0, None)
            return {"success": True, "volume": clamped, "muted": False, "message": f"Volume set to {clamped}%"}
        except Exception as e:
            log.warning("pycaw set_volume failed: %s", e)

    # Fallback via PowerShell
    try:
        ps_cmd = f"$obj = New-Object -ComObject WScript.Shell; 1..50 | % {{ $obj.SendKeys([char]174) }}; 1..{clamped // 2} | % {{ $obj.SendKeys([char]175) }}"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
        return {"success": True, "volume": clamped, "message": f"Volume adjusted to ~{clamped}% (via key emulation)"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def toggle_mute(mute: bool | None = None) -> dict[str, Any]:
    """Mutes, unmutes, or toggles master audio."""
    volume = _get_audio_endpoint()
    if volume:
        try:
            current_mute = bool(volume.GetMute())
            target_mute = (not current_mute) if mute is None else bool(mute)
            volume.SetMute(int(target_mute), None)
            status_str = "muted" if target_mute else "unmuted"
            return {"success": True, "muted": target_mute, "message": f"System audio {status_str}"}
        except Exception as e:
            log.warning("pycaw mute toggle failed: %s", e)

    # Fallback to virtual key
    _send_virtual_key(VK_VOLUME_MUTE)
    return {"success": True, "message": "Toggled mute via virtual key"}

def media_control(action: str) -> dict[str, Any]:
    """
    Controls media playback: 'play_pause', 'next', 'previous', 'stop', 'volume_up', 'volume_down'.
    """
    mapping = {
        "play_pause": VK_MEDIA_PLAY_PAUSE,
        "play": VK_MEDIA_PLAY_PAUSE,
        "pause": VK_MEDIA_PLAY_PAUSE,
        "next": VK_MEDIA_NEXT_TRACK,
        "next_track": VK_MEDIA_NEXT_TRACK,
        "previous": VK_MEDIA_PREV_TRACK,
        "prev_track": VK_MEDIA_PREV_TRACK,
        "prev": VK_MEDIA_PREV_TRACK,
        "stop": VK_MEDIA_STOP,
        "volume_up": VK_VOLUME_UP,
        "volume_down": VK_VOLUME_DOWN,
    }
    normalized = action.lower().strip().replace(" ", "_")
    vk = mapping.get(normalized)
    if not vk:
        return {"success": False, "error": f"Unknown media action '{action}'. Valid: {list(mapping.keys())}"}

    success = _send_virtual_key(vk)
    return {"success": success, "action": normalized, "message": f"Media action executed: {normalized}"}


# ─────────────────────────────────────────────────────────────
# 2. Application & Process Orchestration
# ─────────────────────────────────────────────────────────────

APP_ALIASES: dict[str, str] = {
    "notepad": "notepad.exe",
    "notes": "notepad.exe",
    "calculator": "calc.exe",
    "calc": "calc.exe",
    "paint": "mspaint.exe",
    "chrome": "chrome",
    "browser": "start msedge",
    "edge": "msedge",
    "spotify": "spotify",
    "code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "terminal": "powershell",
    "cmd": "cmd",
    "command prompt": "cmd",
    "explorer": "explorer",
    "file explorer": "explorer",
    "settings": "start ms-settings:",
    "task manager": "taskmgr.exe",
    "taskmgr": "taskmgr.exe",
}

def launch_application(app_name: str) -> dict[str, Any]:
    """Launches an application by name or path without blocking."""
    cleaned = app_name.strip().lower()
    command = APP_ALIASES.get(cleaned, app_name.strip())

    try:
        # Use shell execution so Windows PATH and Protocol handlers work
        if command.startswith("start "):
            subprocess.Popen(command, shell=True)
        else:
            subprocess.Popen(f'start "" "{command}"', shell=True)
        return {"success": True, "app": app_name, "message": f"Successfully launched {app_name}"}
    except Exception as e:
        log.exception("Error launching app '%s': %s", app_name, e)
        return {"success": False, "error": str(e), "app": app_name}

def open_url(url: str) -> dict[str, Any]:
    """Opens a URL in the user's default web browser."""
    target = url.strip()
    if not target.startswith(("http://", "https://")):
        target = "https://" + target
    try:
        webbrowser.open(target)
        return {"success": True, "url": target, "message": f"Opened {target} in browser"}
    except Exception as e:
        return {"success": False, "error": str(e), "url": target}

def get_running_applications(limit: int = 15) -> list[dict[str, Any]]:
    """Lists prominent user-facing running desktop processes."""
    apps = []
    seen = set()
    for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            info = proc.info
            name = info.get("name", "")
            if not name or name in seen:
                continue
            # Filter out low-level system background daemons
            if name.lower().endswith(".exe") and not name.lower().startswith(
                ("svchost", "system", "smss", "csrss", "wininit", "services", "lsass", "fontdrvhost")
            ):
                seen.add(name)
                apps.append({
                    "pid": info["pid"],
                    "name": name,
                    "cpu_percent": round(info.get("cpu_percent") or 0.0, 1),
                    "memory_percent": round(info.get("memory_percent") or 0.0, 1),
                })
                if len(apps) >= limit:
                    break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return apps

def close_process(name_or_pid: str) -> dict[str, Any]:
    """Terminates a process by name or PID."""
    target = name_or_pid.strip()
    terminated = 0

    if target.isdigit():
        pid = int(target)
        try:
            p = psutil.Process(pid)
            p_name = p.name()
            p.terminate()
            return {"success": True, "message": f"Terminated PID {pid} ({p_name})"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Match by executable name
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pname = proc.info.get("name", "").lower()
            if target.lower() in pname or target.lower() + ".exe" == pname:
                proc.terminate()
                terminated += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if terminated > 0:
        return {"success": True, "message": f"Closed {terminated} process(es) matching '{target}'"}
    return {"success": False, "message": f"No running processes found matching '{target}'"}


# ─────────────────────────────────────────────────────────────
# 3. System Telemetry (Hardware, Performance & Battery)
# ─────────────────────────────────────────────────────────────

def get_system_telemetry() -> dict[str, Any]:
    """Fetches real-time CPU, RAM, Disk, and Battery diagnostics."""
    try:
        cpu_usage = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)
        mem = psutil.virtual_memory()

        # Disk C:
        try:
            disk = psutil.disk_usage("C:\\")
            disk_info = {
                "total_gb": round(disk.total / (1024**3), 1),
                "free_gb": round(disk.free / (1024**3), 1),
                "used_percent": round(disk.percent, 1),
            }
        except Exception:
            disk_info = {}

        # Battery
        battery = psutil.sensors_battery()
        battery_info = None
        if battery:
            battery_info = {
                "percent": round(battery.percent),
                "power_plugged": battery.power_plugged,
                "seconds_left": battery.secsleft if battery.secsleft != -1 else None,
            }

        # Uptime
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        hours = uptime_seconds // 3600
        minutes = (uptime_seconds % 3600) // 60

        return {
            "success": True,
            "os": f"{platform.system()} {platform.release()} (Build {platform.version()})",
            "cpu": {"percent": cpu_usage, "cores": cpu_count},
            "memory": {
                "total_gb": round(mem.total / (1024**3), 1),
                "used_gb": round(mem.used / (1024**3), 1),
                "free_gb": round(mem.available / (1024**3), 1),
                "percent": round(mem.percent, 1),
            },
            "disk": disk_info,
            "battery": battery_info,
            "uptime": f"{hours}h {minutes}m",
        }
    except Exception as e:
        log.error("Failed to gather system telemetry: %s", e)
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# 4. Window & Screen Perception
# ─────────────────────────────────────────────────────────────

def get_active_window() -> dict[str, Any]:
    """Gets the title of the currently focused desktop window."""
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        length = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value.strip()
        return {"success": True, "title": title or "(Desktop / Unknown)", "hwnd": hwnd}
    except Exception as e:
        return {"success": False, "error": str(e), "title": "Unknown"}

def minimize_all_windows() -> dict[str, Any]:
    """Simulates Win + D to show/hide the desktop."""
    try:
        user32 = ctypes.windll.user32
        user32.keybd_event(VK_LWIN, 0, 0, 0)
        user32.keybd_event(0x44, 0, 0, 0)  # 'D'
        time.sleep(0.05)
        user32.keybd_event(0x44, 0, KEYEVENTF_KEYUP, 0)
        user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)
        return {"success": True, "message": "Toggled desktop display (Win+D)"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def capture_screenshot(save_dir: str | None = None) -> dict[str, Any]:
    """Captures a full-desktop screenshot and returns file path & resolution."""
    out_dir = Path(save_dir) if save_dir else Path(os.environ.get("TEMP", "."))
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"aegis_screen_{int(time.time())}.png"
    filepath = out_dir / filename

    # Primary: PIL ImageGrab
    try:
        from PIL import ImageGrab  # type: ignore
        img = ImageGrab.grab(all_screens=True)
        img.save(filepath, "PNG")
        return {
            "success": True,
            "path": str(filepath.resolve()),
            "width": img.width,
            "height": img.height,
            "message": f"Captured screenshot: {filename} ({img.width}x{img.height})",
        }
    except Exception as err:
        log.debug("ImageGrab failed (%s), trying mss...", err)

    # Fallback: mss
    try:
        import mss  # type: ignore
        from PIL import Image  # type: ignore
        with mss.mss() as sct:
            mon = sct.monitors[0]
            sct_img = sct.grab(mon)
            img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
            img.save(filepath, "PNG")
            return {
                "success": True,
                "path": str(filepath.resolve()),
                "width": img.width,
                "height": img.height,
                "message": f"Captured screenshot via mss: {filename} ({img.width}x{img.height})",
            }
    except Exception as e:
        log.error("Screenshot capture failed: %s", e)
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# 5. File System Operations
# ─────────────────────────────────────────────────────────────

COMMON_USER_DIRS = [
    Path.home() / "Desktop",
    Path.home() / "Documents",
    Path.home() / "Downloads",
]

def search_files(query: str, root_path: str | None = None, max_results: int = 8) -> list[dict[str, Any]]:
    """Searches user folders for matching files or folders."""
    roots = [Path(root_path)] if root_path else COMMON_USER_DIRS
    results = []
    pattern = query.lower().strip()

    for root in roots:
        if not root.exists():
            continue
        try:
            for path in root.rglob(f"*{pattern}*"):
                if path.name.startswith((".", "$", "node_modules", "venv", "__pycache__")):
                    continue
                results.append({
                    "name": path.name,
                    "path": str(path.resolve()),
                    "is_dir": path.is_dir(),
                    "size_kb": round(path.stat().st_size / 1024, 1) if path.is_file() else None,
                })
                if len(results) >= max_results:
                    return results
        except (PermissionError, OSError):
            continue
    return results

def list_folder(path: str | None = None) -> list[dict[str, Any]]:
    """Lists files and folders inside a given directory (defaults to Desktop)."""
    target = Path(path) if path else (Path.home() / "Desktop")
    if not target.exists() or not target.is_dir():
        return [{"error": f"Directory not found: {target}"}]

    items = []
    try:
        for p in list(target.iterdir())[:30]:
            items.append({
                "name": p.name,
                "is_dir": p.is_dir(),
                "size_kb": round(p.stat().st_size / 1024, 1) if p.is_file() else None,
            })
    except Exception as e:
        items.append({"error": str(e)})
    return items

def read_file_snippet(path: str, max_lines: int = 40) -> dict[str, Any]:
    """Reads the top lines of a text or code file."""
    target = Path(path)
    if not target.exists() or not target.is_file():
        return {"success": False, "error": f"File does not exist: {path}"}
    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            lines = [f.readline() for _ in range(max_lines)]
        return {
            "success": True,
            "filename": target.name,
            "content": "".join(lines).strip(),
            "lines_read": len(lines),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def open_in_explorer(path: str) -> dict[str, Any]:
    """Reveals a file or folder in Windows Explorer."""
    target = Path(path)
    if not target.exists():
        return {"success": False, "error": f"Path not found: {path}"}
    try:
        if target.is_file():
            subprocess.Popen(f'explorer /select,"{target.resolve()}"', shell=True)
        else:
            subprocess.Popen(f'explorer "{target.resolve()}"', shell=True)
        return {"success": True, "message": f"Opened Explorer at {target.name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# 6. PowerShell Command Runner (Safe Sandbox)
# ─────────────────────────────────────────────────────────────

FORBIDDEN_COMMANDS = [
    "format ",
    "rmdir /s /q c:",
    "del /f /s /q c:",
    "reg delete",
    "drop table",
    ":(){ :|:& };:",
    "diskpart",
]

def run_powershell(command: str, timeout_secs: int = 15) -> dict[str, Any]:
    """Executes a PowerShell command with timeout and safety validation."""
    lowered = command.lower()
    for forbidden in FORBIDDEN_COMMANDS:
        if forbidden in lowered:
            return {
                "success": False,
                "error": f"Command rejected: contains hazardous sequence '{forbidden}'",
            }

    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
            capture_output=True,
            text=True,
            timeout=timeout_secs,
        )
        return {
            "success": res.returncode == 0,
            "return_code": res.returncode,
            "stdout": res.stdout.strip()[:2000],
            "stderr": res.stderr.strip()[:1000],
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Command timed out after {timeout_secs}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}
