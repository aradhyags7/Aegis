import logging
from faster_whisper import WhisperModel  # type: ignore

log = logging.getLogger("aegis.whisper")

_model: WhisperModel | None = None


def get_whisper_model() -> WhisperModel:
    global _model
    if _model is None:
        log.info("Loading Faster-Whisper model (base, cpu, int8)...")
        _model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8"
        )
        log.info("Faster-Whisper model loaded.")
    return _model


def transcribe(audio_path: str) -> str:
    model = get_whisper_model()
    segments, info = model.transcribe(audio_path)

    text = ""
    for segment in segments:
        text += segment.text + " "

    return text.strip()