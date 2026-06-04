#!/usr/bin/env python3
"""Shared helpers for Spacebase1 bridge scripts."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

JsonDict = Dict[str, Any]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_AGENT = "arclightbio"
DEFAULT_WORKSPACE = ".spacebase/arclightbio"
EXPECTED_SPACE_ID = "space-46111387-13ad-4e0f-b6ba-96fe54255d26"


def ensure_sdk_path() -> Path:
    candidates = [
        Path.home() / ".codex" / "skills" / "intent-space-agent-pack" / "sdk",
        Path.home() / ".claude" / "skills" / "intent-space-agent-pack" / "sdk",
        REPO_ROOT / "marketplace" / "plugins" / "intent-space-agent-pack" / "sdk",
    ]
    for candidate in candidates:
        if candidate.exists():
            if str(candidate) not in sys.path:
                sys.path.insert(0, str(candidate))
            return candidate
    raise RuntimeError(
        "intent-space-agent-pack SDK not found. Install intent-space-agent-pack skill."
    )


def get_workspace() -> Path:
    relative = os.environ.get("SPACEBASE_WORKSPACE", DEFAULT_WORKSPACE)
    return (REPO_ROOT / relative).resolve()


def get_agent_name() -> str:
    return os.environ.get("SPACEBASE_AGENT_NAME", DEFAULT_AGENT)


def session_map_path(workspace: Path) -> Path:
    return workspace / "session-map.json"


def observatory_meta_path(workspace: Path) -> Path:
    return workspace / "observatory.json"


def enrollment_path(workspace: Path) -> Path:
    return workspace / ".intent-space" / "state" / "station-enrollment.json"


def load_json(path: Path) -> JsonDict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: JsonDict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def load_session_map(workspace: Path) -> JsonDict:
    return load_json(session_map_path(workspace))


def save_session_map(workspace: Path, payload: JsonDict) -> None:
    save_json(session_map_path(workspace), payload)


def build_observatory_url(enrollment: JsonDict) -> Optional[str]:
    if isinstance(enrollment.get("observatory_url"), str):
        return enrollment["observatory_url"]

    station_token = enrollment.get("station_token")
    space_id = enrollment.get("space_id") or enrollment.get("commons_space_id")
    station_endpoint = enrollment.get("station_endpoint") or enrollment.get("itp_endpoint")
    if not isinstance(station_token, str) or not isinstance(space_id, str):
        return None

    origin = "https://spacebase1.differ.ac"
    if isinstance(station_endpoint, str):
        from urllib.parse import urlparse

        parsed = urlparse(station_endpoint)
        if parsed.scheme and parsed.netloc:
            origin = f"{parsed.scheme}://{parsed.netloc}"

    return (
        f"{origin}/observatory#origin={quote(origin, safe='')}"
        f"&space={quote(space_id, safe='')}"
        f"&token={quote(station_token, safe='')}"
    )


def create_connected_session():
    ensure_sdk_path()
    from http_space_tools import HttpSpaceToolSession

    workspace = get_workspace()
    agent_name = get_agent_name()
    enrollment_file = enrollment_path(workspace)
    if not enrollment_file.exists():
        raise RuntimeError(
            f"No enrollment at {enrollment_file}. Run scripts/spacebase/claim.py first."
        )

    enrollment = load_json(enrollment_file)
    endpoint = enrollment.get("station_endpoint") or enrollment.get("itp_endpoint")
    if not isinstance(endpoint, str):
        raise RuntimeError("Enrollment missing station_endpoint")

    session = HttpSpaceToolSession(
        endpoint=endpoint,
        workspace=workspace,
        agent_name=agent_name,
    )
    session.connect()
    return session, workspace
