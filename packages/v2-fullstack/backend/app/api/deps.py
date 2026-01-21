"""
Shared FastAPI dependencies.

Centralizes:
- DB session dependency
- Access mode extraction/validation
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Header, HTTPException

from app.db import get_session as get_session  # re-export for api modules
from app.schemas.shared import AccessMode


def get_access_mode(
    x_access_mode: Annotated[str | None, Header(alias="X-Access-Mode")] = None,
) -> AccessMode:
    """
    Resolve access mode from request header.

    - Default: demo_public
    - Header: X-Access-Mode: demo_public | partner | admin_internal
    """
    if not x_access_mode:
        return AccessMode.DEMO_PUBLIC

    try:
        return AccessMode(x_access_mode)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid X-Access-Mode: {x_access_mode}",
        ) from exc

