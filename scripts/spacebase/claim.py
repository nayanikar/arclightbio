#!/usr/bin/env python3
"""Claim the prepared Spacebase1 space for arclightbio."""
from __future__ import annotations

import json
import sys

from common import (
    EXPECTED_SPACE_ID,
    build_observatory_url,
    ensure_sdk_path,
    enrollment_path,
    get_agent_name,
    get_workspace,
    observatory_meta_path,
    save_json,
)


CLAIM_URL = (
    "https://spacebase1.differ.ac/claim/"
    "space-72519775-65ca-485c-a6bf-a75ef4f46c9b/"
    "aa5bc0d04bc59ab52e805bfa7ea6c800fff5"
)


def main() -> int:
    ensure_sdk_path()
    from http_space_tools import HttpSpaceToolSession

    workspace = get_workspace()
    agent_name = get_agent_name()
    workspace.mkdir(parents=True, exist_ok=True)

    session = HttpSpaceToolSession(
        endpoint=CLAIM_URL,
        workspace=workspace,
        agent_name=agent_name,
    )

    signup = session.signup(CLAIM_URL)
    session.connect()
    binding = session.verify_space_binding()

    enrollment = json.loads(enrollment_path(workspace).read_text(encoding="utf-8"))
    observatory_url = build_observatory_url({**enrollment, **signup})

    if observatory_url:
        save_json(
            observatory_meta_path(workspace),
            {
                "observatory_url": observatory_url,
                "space_id": binding.get("declaredSpaceId") or binding.get("currentSpaceId"),
                "agent_name": agent_name,
            },
        )

    print("declaredSpaceId:", binding.get("declaredSpaceId"))
    print("currentSpaceId:", binding.get("currentSpaceId"))
    print("visibleTopLevelIntents:", binding.get("visibleTopLevelIntents"))
    if observatory_url:
        print("observatory_url:", observatory_url)

    declared = binding.get("declaredSpaceId")
    current = binding.get("currentSpaceId")
    if declared != EXPECTED_SPACE_ID or current != EXPECTED_SPACE_ID:
        print(
            f"WARNING: expected space {EXPECTED_SPACE_ID}, got declared={declared} current={current}",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
    raise SystemExit(main())
