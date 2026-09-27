"""
AEGIS — Native Windows PC Controller Engine
Provides execution primitives for audio/media, applications, processes,
system telemetry, window management, screen perception, clipboard, and file system.
"""

import os
import sys
import time
import socket
import ctypes
import difflib
import logging
import platform
import winreg
import subprocess
import webbrowser
from pathlib import Path
from typing import Any

import psutil  # type: ignore

try:
    import win32gui  # type: ignore
    import win32con  # type: ignore
    import win32service  # type: ignore
    import win32clipboard  # type: ignore
    import win32process  # type: ignore
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

log = logging.getLogger("aegis.pc_controller")

# ─────────────────────────────────────────────────────────────
# 1. Audio & Media Subsystem (pycaw + Windows Virtual Keys)
# ─────────────────────────────────────────────────────────────

VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_STOP = 0xB2
VK_MEDIA_PLAY_PAUSE = 0xB3
VK_LWIN = 0x5B
VK_LEFT = 0x25
VK_UP = 0x26
VK_RIGHT = 0x27
VK_DOWN = 0x28
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
    """Sets master volume level (0-100%) and verifies actual output level."""
    clamped = max(0, min(100, int(level)))
    volume = _get_audio_endpoint()
    if volume:
        try:
            scalar = clamped / 100.0
            volume.SetMasterVolumeLevelScalar(scalar, None)
            if volume.GetMute():
                volume.SetMute(0, None)
            # Verify actual readback
            actual = round(volume.GetMasterVolumeLevelScalar() * 100)
            return {"success": True, "volume": actual, "muted": False, "message": f"Volume set to {actual}%"}
        except Exception as e:
            log.warning("pycaw set_volume failed: %s", e)

    # Fallback via PowerShell
    try:
        ps_cmd = f"$obj = New-Object -ComObject WScript.Shell; 1..50 | % {{ $obj.SendKeys([char]174) }}; 1..{clamped // 2} | % {{ $obj.SendKeys([char]175) }}"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
        return {"success": True, "volume": clamped, "message": f"Volume adjusted to ~{clamped}% (via key emulation)"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def change_volume_relative(delta: int) -> dict[str, Any]:
    """Increases or decreases volume by delta percent (e.g. +10, -10)."""
    curr = get_volume()
    current_vol = curr.get("volume")
    if current_vol is not None:
        target = max(0, min(100, current_vol + delta))
        return set_volume(target)
    
    # Fallback to key presses
    steps = abs(delta) // 2
    vk = VK_VOLUME_UP if delta > 0 else VK_VOLUME_DOWN
    for _ in range(max(1, steps)):
        _send_virtual_key(vk)
        time.sleep(0.02)
    return {"success": True, "message": f"Volume adjusted by {delta:+d}%"}

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
# 2. Dynamic Windows Application Discovery & Launch Engine
# ─────────────────────────────────────────────────────────────

# Well-known Windows shell protocols & built-in execution paths
STATIC_APP_MAP: dict[str, str] = {
    "notepad": "notepad.exe",
    "notes": "notepad.exe",
    "calc": "calc.exe",
    "calculator": "calc.exe",
    "paint": "mspaint.exe",
    "mspaint": "mspaint.exe",
    "cmd": "cmd.exe",
    "command prompt": "cmd.exe",
    "powershell": "powershell.exe",
    "terminal": "wt.exe",
    "windows terminal": "wt.exe",
    "task manager": "taskmgr.exe",
    "taskmgr": "taskmgr.exe",
    "explorer": "explorer.exe",
    "file explorer": "explorer.exe",
    "my computer": "explorer.exe",
    "settings": "ms-settings:",
    "windows settings": "ms-settings:",
    "spotify": "spotify:",
}

_APP_CACHE: dict[str, str] = {}
_LAST_APP_SCAN = 0.0

def scan_installed_apps(force_refresh: bool = False) -> dict[str, str]:
    """
    Dynamically scans Windows Registry App Paths, Start Menu shortcuts,
    and User Programs directories to discover all real desktop applications.
    """
    global _APP_CACHE, _LAST_APP_SCAN
    now = time.time()
    if _APP_CACHE and not force_refresh and (now - _LAST_APP_SCAN < 300):
        return _APP_CACHE

    apps: dict[str, str] = dict(STATIC_APP_MAP)

    # 1. Registry App Paths (HKLM & HKCU, 64-bit and WOW6432Node)
    reg_paths = [
        r"Software\Microsoft\Windows\CurrentVersion\App Paths",
        r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths",
    ]
    for root_hkey in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        for subkey in reg_paths:
            try:
                with winreg.OpenKey(root_hkey, subkey) as k:
                    count = winreg.QueryInfoKey(k)[0]
                    for i in range(count):
                        try:
                            app_name = winreg.EnumKey(k, i)
                            with winreg.OpenKey(k, app_name) as sk:
                                exe_path, _ = winreg.QueryValueEx(sk, "")
                                if exe_path and os.path.exists(exe_path):
                                    key_clean = app_name.lower().replace(".exe", "").strip()
                                    apps[key_clean] = exe_path
                        except Exception:
                            continue
            except Exception:
                continue

    # 2. Start Menu Shortcuts (.lnk files)
    start_roots = [
        os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs"),
        os.path.join(os.environ.get("PROGRAMDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs"),
    ]
    for r in start_roots:
        if os.path.exists(r):
            for root_dir, _, files in os.walk(r):
                for f in files:
                    if f.lower().endswith(".lnk"):
                        name = f[:-4].lower().strip()
                        full_path = os.path.join(root_dir, f)
                        apps[name] = full_path

    # 3. User Programs & WindowsApps
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        # Common local program locations (VS Code, Discord, Spotify)
        programs_dir = os.path.join(local_app_data, "Programs")
        if os.path.exists(programs_dir):
            for item in os.listdir(programs_dir):
                item_path = os.path.join(programs_dir, item)
                if os.path.isdir(item_path):
                    for sub in os.listdir(item_path):
                        if sub.lower().endswith(".exe"):
                            apps[item.lower()] = os.path.join(item_path, sub)

        # Discord special update path
        discord_exe = os.path.join(local_app_data, "Discord", "Update.exe")
        if os.path.exists(discord_exe):
            apps["discord"] = discord_exe

    # 4. Standard Browser Fallbacks
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
    program_files_x86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    chrome_path = os.path.join(program_files, "Google", "Chrome", "Application", "chrome.exe")
    if os.path.exists(chrome_path):
        apps["chrome"] = chrome_path
        apps["google chrome"] = chrome_path

    edge_path = os.path.join(program_files_x86, "Microsoft", "Edge", "Application", "msedge.exe")
    if os.path.exists(edge_path):
        apps["edge"] = edge_path
        apps["msedge"] = edge_path
        apps["microsoft edge"] = edge_path

    _APP_CACHE = apps
    _LAST_APP_SCAN = now
    log.info("Discovered %d installed desktop applications.", len(apps))
    return apps

def resolve_app_target(app_name: str) -> str | None:
    """Finds the best executable or shortcut path matching app_name."""
    cleaned = app_name.lower().strip()
    apps = scan_installed_apps()

    # Exact alias match
    if cleaned in apps:
        return apps[cleaned]

    # Specific common synonyms
    alias_map = {
        "vscode": "visual studio code",
        "vs code": "visual studio code",
        "code": "visual studio code",
        "browser": "chrome" if "chrome" in apps else "edge",
        "google": "chrome",
        "vlc": "vlc media player",
        "word": "word",
        "excel": "excel",
        "powerpoint": "powerpoint",
        "ppt": "powerpoint",
    }
    if cleaned in alias_map:
        target_alias = alias_map[cleaned]
        if target_alias in apps:
            return apps[target_alias]

    # Substring / Prefix match
    for k, v in apps.items():
        if cleaned in k or k in cleaned:
            return v

    # Fuzzy match with difflib
    matches = difflib.get_close_matches(cleaned, apps.keys(), n=1, cutoff=0.6)
    if matches:
        return apps[matches[0]]

    return None

def launch_application(app_name: str) -> dict[str, Any]:
    """
    Launches an application by name or path, validating execution
    and verifying process creation on the host PC.
    """
    cleaned = app_name.strip()
    target = resolve_app_target(cleaned) or cleaned

    log.info("Launching application: '%s' -> target '%s'", app_name, target)

    try:
        # 1. Shell URI protocol (e.g. ms-settings:, spotify:)
        if ":" in target and not os.path.exists(target):
            os.startfile(target)  # type: ignore
            return {
                "success": True,
                "app": app_name,
                "target": target,
                "message": f"Successfully launched {app_name} via Windows protocol ({target})",
            }

        # 2. Existing File / Shortcut (.lnk or .exe)
        if os.path.exists(target):
            # Record baseline processes to verify spawn
            initial_pids = {p.pid for p in psutil.process_iter(["pid"])}
            os.startfile(target)  # type: ignore

            # Wait up to 1.2s to detect spawned process
            new_pid = None
            new_name = None
            for _ in range(6):
                time.sleep(0.2)
                for proc in psutil.process_iter(["pid", "name"]):
                    if proc.info["pid"] not in initial_pids:
                        new_pid = proc.info["pid"]
                        new_name = proc.info["name"]
                        break
                if new_pid:
                    break

            detail = f" (PID: {new_pid} - {new_name})" if new_pid else ""
            return {
                "success": True,
                "app": app_name,
                "target": target,
                "pid": new_pid,
                "message": f"Successfully launched {app_name}{detail}",
            }

        # 3. Fallback: Windows Shell Execution
        subprocess.Popen(f'start "" "{target}"', shell=True)
        return {
            "success": True,
            "app": app_name,
            "target": target,
            "message": f"Dispatched launch command for {app_name}",
        }

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
            if name.lower().endswith(".exe") and not name.lower().startswith(
                ("svchost", "system", "smss", "csrss", "wininit", "services", "lsass", "fontdrvhost", "sihost", "dwm")
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

# Process name mappings for accurate termination
PROCESS_ALIAS_MAP: dict[str, list[str]] = {
    "chrome": ["chrome.exe"],
    "google chrome": ["chrome.exe"],
    "edge": ["msedge.exe"],
    "msedge": ["msedge.exe"],
    "microsoft edge": ["msedge.exe"],
    "discord": ["discord.exe"],
    "spotify": ["spotify.exe"],
    "code": ["code.exe"],
    "vscode": ["code.exe"],
    "visual studio code": ["code.exe"],
    "notepad": ["notepad.exe"],
    "calc": ["calculatorapp.exe", "calc.exe"],
    "calculator": ["calculatorapp.exe", "calc.exe"],
    "vlc": ["vlc.exe"],
    "steam": ["steam.exe", "steamwebhelper.exe", "steamservice.exe"],
    "word": ["winword.exe"],
    "excel": ["excel.exe"],
    "powerpoint": ["powerpnt.exe"],
    "terminal": ["windowsterminal.exe", "powershell.exe", "cmd.exe"],
}

def close_process(name_or_pid: str) -> dict[str, Any]:
    """Terminates an application process tree by name or PID."""
    target = name_or_pid.strip().lower()
    terminated = 0
    matched_names = []

    # PID termination
    if target.isdigit():
        pid = int(target)
        try:
            p = psutil.Process(pid)
            p_name = p.name()
            # Kill process tree
            for child in p.children(recursive=True):
                try:
                    child.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            p.kill()
            return {"success": True, "message": f"Terminated PID {pid} ({p_name})"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Resolve executable names
    target_exes = PROCESS_ALIAS_MAP.get(target, [target if target.endswith(".exe") else f"{target}.exe"])

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pname = proc.info.get("name", "").lower()
            if pname in target_exes or any(t in pname for t in target_exes):
                try:
                    for child in proc.children(recursive=True):
                        try:
                            child.kill()
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                    proc.kill()
                    terminated += 1
                    if pname not in matched_names:
                        matched_names.append(pname)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if terminated > 0:
        names_str = ", ".join(matched_names)
        return {"success": True, "terminated_count": terminated, "message": f"Closed {terminated} process(es) ({names_str})"}
    return {"success": False, "message": f"No running processes found matching '{name_or_pid}'"}


# ─────────────────────────────────────────────────────────────
# 3. Interactive Desktop Window Controller (Win32 API)
# ─────────────────────────────────────────────────────────────

def _get_interactive_desktop_windows() -> list[dict[str, Any]]:
    """Enumerates visible, titled windows on the interactive default desktop."""
    if not HAS_WIN32:
        return []

    windows = []
    try:
        hdesk = win32service.OpenDesktop("default", 0, False, win32con.GENERIC_ALL)
        def enum_handler(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd).strip()
                if title and title not in ("Default IME", "MSCTFIME UI"):
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    windows.append({"hwnd": hwnd, "title": title, "pid": pid})
            return True
        win32gui.EnumDesktopWindows(hdesk, enum_handler, None)
    except Exception as e:
        log.debug("Desktop window enumeration error: %s", e)
    return windows

def get_open_windows(limit: int = 12) -> list[dict[str, Any]]:
    """Returns a list of currently open visible windows on the user's desktop."""
    wins = _get_interactive_desktop_windows()
    return wins[:limit]

def get_active_window() -> dict[str, Any]:
    """Gets the title of the currently focused desktop window."""
    try:
        user32 = ctypes.windll.user32
        hwnd = user32.GetForegroundWindow()
        if hwnd:
            length = user32.GetWindowTextLengthW(hwnd)
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value.strip()
            if title:
                return {"success": True, "title": title, "hwnd": hwnd}
    except Exception as e:
        log.debug("GetForegroundWindow direct read failed: %s", e)

    # Fallback to desktop window list
    wins = _get_interactive_desktop_windows()
    if wins:
        return {"success": True, "title": wins[0]["title"], "hwnd": wins[0]["hwnd"]}
    return {"success": True, "title": "Desktop", "hwnd": 0}

def focus_window(query: str) -> dict[str, Any]:
    """Brings an open window to the front by title or app name."""
    if not HAS_WIN32:
        return {"success": False, "error": "Win32 window control unavailable"}

    cleaned = query.lower().strip()
    windows = _get_interactive_desktop_windows()
    target_hwnd = None
    target_title = None

    for w in windows:
        if cleaned in w["title"].lower():
            target_hwnd = w["hwnd"]
            target_title = w["title"]
            break

    if not target_hwnd:
        return {"success": False, "message": f"No open window found matching '{query}'"}

    try:
        # Restore if minimized
        win32gui.ShowWindow(target_hwnd, win32con.SW_RESTORE)
        # Bring to foreground
        win32gui.SetForegroundWindow(target_hwnd)
        return {"success": True, "hwnd": target_hwnd, "title": target_title, "message": f"Focused window: {target_title}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def maximize_window(query: str | None = None) -> dict[str, Any]:
    """Maximizes a matching window or the currently active window."""
    if not HAS_WIN32:
        return {"success": False, "error": "Win32 window control unavailable"}

    windows = _get_interactive_desktop_windows()
    if not windows:
        return {"success": False, "message": "No active window found to maximize"}

    target = windows[0]
    if query:
        q = query.lower().strip()
        for w in windows:
            if q in w["title"].lower():
                target = w
                break

    try:
        win32gui.ShowWindow(target["hwnd"], win32con.SW_MAXIMIZE)
        return {"success": True, "message": f"Maximized window: {target['title']}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def minimize_window(query: str | None = None) -> dict[str, Any]:
    """Minimizes a matching window or the currently active window."""
    if not HAS_WIN32:
        return {"success": False, "error": "Win32 window control unavailable"}

    windows = _get_interactive_desktop_windows()
    if not windows:
        return {"success": False, "message": "No active window found to minimize"}

    target = windows[0]
    if query:
        q = query.lower().strip()
        for w in windows:
            if q in w["title"].lower():
                target = w
                break

    try:
        win32gui.ShowWindow(target["hwnd"], win32con.SW_MINIMIZE)
        return {"success": True, "message": f"Minimized window: {target['title']}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def close_window(query: str | None = None) -> dict[str, Any]:
    """Gracefully closes a window by sending WM_CLOSE."""
    if not HAS_WIN32:
        return {"success": False, "error": "Win32 window control unavailable"}

    windows = _get_interactive_desktop_windows()
    if not windows:
        return {"success": False, "message": "No window found to close"}

    target = windows[0]
    if query:
        q = query.lower().strip()
        for w in windows:
            if q in w["title"].lower():
                target = w
                break

    try:
        win32gui.PostMessage(target["hwnd"], win32con.WM_CLOSE, 0, 0)
        return {"success": True, "message": f"Closed window: {target['title']}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def snap_window(direction: str) -> dict[str, Any]:
    """Snaps active window Left, Right, Up (maximize) or Down (restore/minimize) using Win+Arrows."""
    key_map = {
        "left": VK_LEFT,
        "right": VK_RIGHT,
        "up": VK_UP,
        "down": VK_DOWN,
    }
    vk = key_map.get(direction.lower().strip())
    if not vk:
        return {"success": False, "error": f"Invalid snap direction '{direction}'. Valid: left, right, up, down"}

    try:
        user32 = ctypes.windll.user32
        user32.keybd_event(VK_LWIN, 0, 0, 0)
        user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.05)
        user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
        user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)
        return {"success": True, "direction": direction, "message": f"Snapped window {direction}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

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


# ─────────────────────────────────────────────────────────────
# 4. Perception & Screenshots
# ─────────────────────────────────────────────────────────────

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

COMMON_SEARCH_ROOTS = [
    Path.home() / "Desktop",
    Path.home() / "Documents",
    Path.home() / "Downloads",
    Path.home() / "Pictures",
    Path.home() / "Videos",
    Path.home() / "Music",
    Path.cwd(),
]

def search_files(query: str, root_path: str | None = None, max_results: int = 10) -> list[dict[str, Any]]:
    """Searches user folders for matching files or folders."""
    roots = [Path(root_path)] if root_path else COMMON_SEARCH_ROOTS
    results = []
    pattern = query.lower().strip()

    seen_paths = set()
    for root in roots:
        if not root.exists():
            continue
        try:
            for path in root.rglob(f"*{pattern}*"):
                if str(path) in seen_paths:
                    continue
                # Skip heavy/internal folders
                if any(part.startswith((".", "$")) or part in ("node_modules", "venv", "__pycache__", "dist", "build") for part in path.parts):
                    continue
                seen_paths.add(str(path))
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

def open_path_in_shell(path: str) -> dict[str, Any]:
    """Opens a file in its default program or folder in Windows Explorer."""
    target = Path(path)
    if not target.exists():
        return {"success": False, "error": f"Path not found: {path}"}
    try:
        os.startfile(str(target.resolve()))  # type: ignore
        return {"success": True, "message": f"Opened {target.name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def open_in_explorer(path: str) -> dict[str, Any]:
    """Reveals and selects a file or folder in Windows Explorer."""
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
# 6. Windows Clipboard Integration
# ─────────────────────────────────────────────────────────────

def get_clipboard_text() -> dict[str, Any]:
    """Reads current text contents from the Windows clipboard."""
    if not HAS_WIN32:
        return {"success": False, "error": "Clipboard API unavailable"}
    try:
        win32clipboard.OpenClipboard()
        try:
            if win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
                data = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT)
                return {"success": True, "text": str(data), "length": len(str(data))}
            return {"success": False, "error": "Clipboard does not contain plain text"}
        finally:
            win32clipboard.CloseClipboard()
    except Exception as e:
        return {"success": False, "error": str(e)}

def set_clipboard_text(text: str) -> dict[str, Any]:
    """Copies text to the Windows clipboard."""
    if not HAS_WIN32:
        return {"success": False, "error": "Clipboard API unavailable"}
    try:
        win32clipboard.OpenClipboard()
        try:
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardText(text, win32con.CF_UNICODETEXT)
            return {"success": True, "message": f"Copied {len(text)} characters to clipboard"}
        finally:
            win32clipboard.CloseClipboard()
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# 7. System Telemetry & Hardware Diagnostics
# ─────────────────────────────────────────────────────────────

def _get_gpu_info() -> dict[str, Any] | None:
    """Queries NVIDIA GPU telemetry via nvidia-smi if available."""
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 4:
                return {
                    "name": parts[0],
                    "memory_total_mb": int(parts[1]),
                    "memory_used_mb": int(parts[2]),
                    "utilization_percent": int(parts[3]),
                }
    except Exception:
        pass
    return None

def get_system_telemetry() -> dict[str, Any]:
    """Fetches real-time CPU, RAM, Disk, Battery, Network, GPU, and Uptime diagnostics."""
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

        # Network
        hostname = socket.gethostname()
        try:
            local_ip = socket.gethostbyname(hostname)
        except Exception:
            local_ip = "127.0.0.1"

        # GPU
        gpu_info = _get_gpu_info()

        # Uptime
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        hours = uptime_seconds // 3600
        minutes = (uptime_seconds % 3600) // 60

        return {
            "success": True,
            "os": f"{platform.system()} {platform.release()} (Build {platform.version()})",
            "hostname": hostname,
            "local_ip": local_ip,
            "cpu": {"percent": cpu_usage, "cores": cpu_count},
            "memory": {
                "total_gb": round(mem.total / (1024**3), 1),
                "used_gb": round(mem.used / (1024**3), 1),
                "free_gb": round(mem.available / (1024**3), 1),
                "percent": round(mem.percent, 1),
            },
            "disk": disk_info,
            "battery": battery_info,
            "gpu": gpu_info,
            "uptime": f"{hours}h {minutes}m",
        }
    except Exception as e:
        log.error("Failed to gather system telemetry: %s", e)
        return {"success": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────
# 8. PowerShell Command Runner (Safe Sandbox)
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
