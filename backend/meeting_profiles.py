"""
Meeting profile management.

Profiles define optional customization for how minutes are generated.
The default profile keeps the app generic for any organization.
"""

import json
import uuid
from pathlib import Path

from config import DATA_DIR, DEFAULT_ORGANIZATION_NAME, DEFAULT_PROFILE_ID, SYSTEM_PROMPT

PROFILES_FILE = Path(DATA_DIR) / "profiles.json"


def _default_profile() -> dict:
    return {
        "id": DEFAULT_PROFILE_ID,
        "name": "General Meeting",
        "organization_name": DEFAULT_ORGANIZATION_NAME,
        "meeting_type": "General",
        "tone": "formal",
        "custom_instructions": "",
        "is_default": True,
    }


def _normalize_profile(profile: dict) -> dict:
    return {
        "id": str(profile.get("id") or uuid.uuid4()),
        "name": str(profile.get("name") or "Custom Profile").strip() or "Custom Profile",
        "organization_name": str(
            profile.get("organization_name") or DEFAULT_ORGANIZATION_NAME
        ).strip()
        or DEFAULT_ORGANIZATION_NAME,
        "meeting_type": str(profile.get("meeting_type") or "General").strip() or "General",
        "tone": str(profile.get("tone") or "formal").strip().lower() or "formal",
        "custom_instructions": str(profile.get("custom_instructions") or "").strip(),
        "is_default": bool(profile.get("is_default", False)),
    }


def load_profiles() -> list[dict]:
    """Load profiles from disk, always returning at least the default profile."""
    PROFILES_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not PROFILES_FILE.exists():
        profiles = [_default_profile()]
        save_profiles(profiles)
        return profiles

    try:
        raw = json.loads(PROFILES_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = []

    profiles = []
    if isinstance(raw, list):
        profiles = [_normalize_profile(p) for p in raw if isinstance(p, dict)]

    if not any(p.get("id") == DEFAULT_PROFILE_ID for p in profiles):
        profiles.insert(0, _default_profile())

    save_profiles(profiles)
    return profiles


def save_profiles(profiles: list[dict]) -> None:
    """Persist profiles to disk."""
    PROFILES_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROFILES_FILE.write_text(json.dumps(profiles, indent=2), encoding="utf-8")


def get_profile(profile_id: str | None) -> dict:
    """Return a profile by ID, falling back to default when missing."""
    profiles = load_profiles()
    wanted = profile_id or DEFAULT_PROFILE_ID
    for profile in profiles:
        if profile.get("id") == wanted:
            return profile
    return next((p for p in profiles if p.get("id") == DEFAULT_PROFILE_ID), _default_profile())


def create_profile(payload: dict) -> dict:
    """Create and persist a custom profile from request payload."""
    profile = _normalize_profile(payload)
    profile["id"] = str(uuid.uuid4())
    profile["is_default"] = False

    profiles = load_profiles()
    profiles.append(profile)
    save_profiles(profiles)
    return profile


def update_profile(profile_id: str, payload: dict) -> dict:
    """Update an existing profile by ID and return the updated value."""
    profiles = load_profiles()
    for idx, existing in enumerate(profiles):
        if existing.get("id") != profile_id:
            continue

        merged = {
            **existing,
            **payload,
            "id": profile_id,
            "is_default": bool(existing.get("is_default", False)),
        }
        updated = _normalize_profile(merged)
        updated["id"] = profile_id
        updated["is_default"] = bool(existing.get("is_default", False))
        profiles[idx] = updated
        save_profiles(profiles)
        return updated

    raise ValueError("profile not found")


def build_system_prompt(profile: dict | None) -> str:
    """Create a system prompt with optional profile-specific guidance."""
    active = profile or _default_profile()

    extras: list[str] = []
    org_name = str(active.get("organization_name") or "").strip()
    meeting_type = str(active.get("meeting_type") or "").strip()
    tone = str(active.get("tone") or "formal").strip().lower()
    custom = str(active.get("custom_instructions") or "").strip()

    if org_name:
        extras.append(f"Organization: {org_name}")
    if meeting_type:
        extras.append(f"Meeting type: {meeting_type}")
    if tone:
        extras.append(f"Preferred tone: {tone}")
    if custom:
        extras.append(f"Custom instructions: {custom}")

    if not extras:
        return SYSTEM_PROMPT

    return f"{SYSTEM_PROMPT}\n\nProfile Context:\n" + "\n".join(f"- {line}" for line in extras)
