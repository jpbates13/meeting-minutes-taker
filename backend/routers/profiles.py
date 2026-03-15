"""Meeting profile routes."""

from fastapi import APIRouter, HTTPException

from meeting_profiles import create_profile, load_profiles, update_profile

router = APIRouter(prefix="/profiles")


@router.get("")
def list_profiles():
    """Return all meeting profiles, including the generic default."""
    return load_profiles()


@router.post("")
def add_profile(body: dict):
    """Create a new custom meeting profile."""
    name = body.get("name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(status_code=422, detail="name is required")

    return create_profile(body)


@router.patch("/{profile_id}")
def edit_profile(profile_id: str, body: dict):
    """Update fields for an existing meeting profile."""
    if "name" in body:
        name = body.get("name")
        if not isinstance(name, str) or not name.strip():
            raise HTTPException(status_code=422, detail="name must be a non-empty string")

    try:
        return update_profile(profile_id, body)
    except ValueError:
        raise HTTPException(status_code=404, detail="profile not found")
