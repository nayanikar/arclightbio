#!/usr/bin/env python3
"""Emit one Arclight lifecycle event to Spacebase1 intent space."""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional

from common import (
    create_connected_session,
    load_session_map,
    save_session_map,
)

JsonDict = Dict[str, Any]


def agent_key(event: JsonDict) -> str:
    agent = str(event.get("agent", "unknown"))
    phase = event.get("phase")
    if isinstance(phase, str) and phase:
        return f"{agent}-{phase}"
    return agent


def top_level_space(session) -> str:
    return (
        session.current_space_id
        or session.declared_default_space_id
        or "root"
    )


def handle_session_started(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    search_query = event.get("searchQuery") or "Discovery session"
    tier = event.get("tier")
    content = f"Discovery: {search_query}"
    if tier:
        content += f" [{tier}]"

    parent_id = top_level_space(session)
    posted = session.post_and_confirm(
        session.intent(content, parent_id=parent_id),
        step="arclight.session_started",
        confirm_space_id=parent_id,
    )
    session_intent_id = posted["intentId"]

    session_map = load_session_map(workspace)
    session_map[opportunity_id] = {
        "sessionIntentId": session_intent_id,
        "agents": {},
        "surveillance": {},
    }
    save_session_map(workspace, session_map)


def get_session_entry(workspace, opportunity_id: str) -> JsonDict:
    session_map = load_session_map(workspace)
    entry = session_map.get(opportunity_id)
    if not isinstance(entry, dict) or not entry.get("sessionIntentId"):
        raise KeyError(f"No session intent for opportunity {opportunity_id}")
    return entry


def handle_agent_started(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    key = agent_key(event)
    entry = get_session_entry(workspace, opportunity_id)
    session_space = entry["sessionIntentId"]

    intent_msg = session.post_and_confirm(
        session.intent(
            f"Running {key} agent",
            parent_id=session_space,
            payload={"agent": key, "opportunityId": opportunity_id},
        ),
        step=f"arclight.agent_started.{key}",
        confirm_space_id=session_space,
    )
    agent_intent_id = intent_msg["intentId"]

    promise_msg = session.post(
        session.promise(
            parent_id=agent_intent_id,
            intent_id=agent_intent_id,
            content=f"{key} agent running",
            payload={"agent": key, "status": "running"},
        ),
        step=f"arclight.agent_promise.{key}",
    )

    entry.setdefault("agents", {})[key] = {
        "intentId": agent_intent_id,
        "promiseId": promise_msg["promiseId"],
    }
    session_map = load_session_map(workspace)
    session_map[opportunity_id] = entry
    save_session_map(workspace, session_map)


def handle_agent_completed(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    key = agent_key(event)
    entry = get_session_entry(workspace, opportunity_id)
    agent_state = entry.get("agents", {}).get(key)
    if not isinstance(agent_state, dict):
        return

    promise_id = agent_state.get("promiseId")
    intent_id = agent_state.get("intentId")
    if not isinstance(promise_id, str) or not isinstance(intent_id, str):
        return

    duration_ms = event.get("durationMs")
    summary = f"{key} agent completed"
    if isinstance(duration_ms, (int, float)):
        summary += f" in {int(duration_ms)}ms"

    session.post(
        session.complete(
            promise_id=promise_id,
            parent_id=intent_id,
            summary=summary,
            payload={"agent": key, "status": "completed"},
        ),
        step=f"arclight.agent_completed.{key}",
    )


def handle_agent_failed(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    key = agent_key(event)
    entry = get_session_entry(workspace, opportunity_id)
    agent_state = entry.get("agents", {}).get(key)
    if not isinstance(agent_state, dict):
        return

    promise_id = agent_state.get("promiseId")
    intent_id = agent_state.get("intentId")
    if not isinstance(promise_id, str) or not isinstance(intent_id, str):
        return

    error = event.get("error") or "Agent failed"
    session.post(
        session.complete(
            promise_id=promise_id,
            parent_id=intent_id,
            summary=f"{key} agent failed: {error}",
            payload={"agent": key, "status": "failed", "error": str(error)},
        ),
        step=f"arclight.agent_failed.{key}",
    )


def handle_blackboard_completed(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    entry = get_session_entry(workspace, opportunity_id)
    session_space = entry["sessionIntentId"]
    confidence = event.get("confidence")
    zone = event.get("zone")
    parts = ["Blackboard complete"]
    if confidence is not None:
        parts.append(f"confidence {confidence}")
    if zone:
        parts.append(f"zone {zone}")

    session.post(
        session.intent(
            " · ".join(parts),
            parent_id=session_space,
            payload={"opportunityId": opportunity_id, "status": "surveillance"},
        ),
        step="arclight.blackboard_completed",
    )


def handle_surveillance_started(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    entry = get_session_entry(workspace, opportunity_id)
    session_space = entry["sessionIntentId"]

    intent_msg = session.post(
        session.intent(
            "Surveillance scan started",
            parent_id=session_space,
            payload={"opportunityId": opportunity_id},
        ),
        step="arclight.surveillance_started",
    )
    agent_intent_id = intent_msg["intentId"]
    promise_msg = session.post(
        session.promise(
            parent_id=agent_intent_id,
            intent_id=agent_intent_id,
            content="Scanning PubMed, trials, patents",
        ),
        step="arclight.surveillance_promise",
    )

    entry["surveillance"] = {
        "intentId": agent_intent_id,
        "promiseId": promise_msg["promiseId"],
    }
    session_map = load_session_map(workspace)
    session_map[opportunity_id] = entry
    save_session_map(workspace, session_map)


def handle_surveillance_completed(session, workspace, event: JsonDict) -> None:
    opportunity_id = event["opportunityId"]
    entry = get_session_entry(workspace, opportunity_id)
    surv = entry.get("surveillance")
    if not isinstance(surv, dict):
        return

    promise_id = surv.get("promiseId")
    intent_id = surv.get("intentId")
    if not isinstance(promise_id, str) or not isinstance(intent_id, str):
        return

    new_signals = event.get("newSignals", 0)
    summary = f"Surveillance scan complete · {new_signals} new signals"
    session.post(
        session.complete(
            promise_id=promise_id,
            parent_id=intent_id,
            summary=summary,
            payload={"newSignals": new_signals},
        ),
        step="arclight.surveillance_completed",
    )
    entry["surveillance"] = {}
    session_map = load_session_map(workspace)
    session_map[opportunity_id] = entry
    save_session_map(workspace, session_map)


HANDLERS = {
    "session_started": handle_session_started,
    "agent_started": handle_agent_started,
    "agent_completed": handle_agent_completed,
    "agent_failed": handle_agent_failed,
    "blackboard_completed": handle_blackboard_completed,
    "surveillance_started": handle_surveillance_started,
    "surveillance_completed": handle_surveillance_completed,
}


def dispatch(event: JsonDict) -> None:
    event_type = event.get("type")
    handler = HANDLERS.get(event_type)
    if handler is None:
        raise ValueError(f"Unknown event type: {event_type}")

    session, workspace = create_connected_session()
    handler(session, workspace, event)
    session.close()


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("No event JSON on stdin", file=sys.stderr)
        return 1
    event = json.loads(raw)
    dispatch(event)
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
    raise SystemExit(main())
