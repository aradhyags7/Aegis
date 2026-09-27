import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.tools import fast_path_intent, execute_tool
from ai import pc_controller


def test_fast_path_intents():
    phrases = [
        ("can you please open chrome", "launch_app"),
        ("open up chrome", "launch_app"),
        ("start chrome", "launch_app"),
        ("please close notepad", "close_app"),
        ("close chrome", "close_app"),
        ("switch to chrome", "focus_window"),
        ("bring chrome to the front", "focus_window"),
        ("make it full screen", "window_state"),
        ("maximize window", "window_state"),
        ("snap left", "window_state"),
        ("snap right", "window_state"),
        ("make it louder", "adjust_volume"),
        ("make it quieter", "adjust_volume"),
        ("turn up the volume", "adjust_volume"),
        ("turn down the sound", "adjust_volume"),
        ("turn up volume by 20", "adjust_volume"),
        ("set volume to 60%", "adjust_volume"),
        ("mute audio", "adjust_volume"),
        ("unmute", "adjust_volume"),
        ("what is my battery percentage", "get_system_stats"),
        ("is my laptop charging", "get_system_stats"),
        ("what is my ip address", "get_system_stats"),
        ("what gpu do i have", "get_system_stats"),
        ("how much ram is used", "get_system_stats"),
        ("how much storage is left", "get_system_stats"),
        ("show desktop", "minimize_all"),
        ("what windows are open", "get_open_windows"),
        ("find file resume.docx", "search_files"),
        ("what is on my clipboard", "clipboard_op"),
        ("copy testing aegis to clipboard", "clipboard_op"),
        ("play music", "media_control"),
        ("next track", "media_control"),
    ]
    
    failed = []
    for text, expected_tool in phrases:
        intent = fast_path_intent(text)
        if not intent or intent[0] != expected_tool:
            failed.append((text, expected_tool, intent[0] if intent else None))
            
    assert not failed, f"Failed phrases: {failed}"
    print(f"[OK] All {len(phrases)} natural voice & text intents passed successfully!")

def test_telemetry_execution():
    res = pc_controller.get_system_telemetry()
    assert res.get("success") is True, f"Telemetry failed: {res}"
    assert "cpu" in res and "memory" in res and "disk" in res
    print(f"[OK] Telemetry executed: OS={res.get('os')}, IP={res.get('local_ip')}, CPU={res['cpu']['percent']}%")

def test_clipboard_execution():
    set_res = pc_controller.set_clipboard_text("AEGIS_TEST_123")
    assert set_res.get("success") is True, f"Clipboard set failed: {set_res}"
    get_res = pc_controller.get_clipboard_text()
    assert get_res.get("success") is True and "AEGIS_TEST_123" in get_res.get("text", "")
    print("[OK] Clipboard execution verified.")

def test_volume_execution():
    vol_res = pc_controller.get_volume()
    assert vol_res.get("success") is True, f"Get volume failed: {vol_res}"
    print(f"[OK] Audio volume verified at {vol_res.get('volume')}%")


if __name__ == "__main__":
    test_fast_path_intents()
    test_telemetry_execution()
    test_clipboard_execution()
    test_volume_execution()
    print("\nAll AEGIS PC Controller tests PASSED flawlessly!")
