"""
Drop-in FastAPI router for salescrm-api.

Mount in the main app:
    from integrations.cloudtalk_proxy_router import router as cloudtalk_router
    app.include_router(cloudtalk_router, prefix="/api/v1")

Environment:
    CLOUDTALK_KEY_ID
    CLOUDTALK_API_SECRET
    CLOUDTALK_API_BASE=https://my.cloudtalk.io/api
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(prefix="/integrations/cloudtalk", tags=["CloudTalk"])

CLOUDTALK_API_BASE = os.getenv("CLOUDTALK_API_BASE", "https://my.cloudtalk.io/api").rstrip("/")
CLOUDTALK_KEY_ID = os.getenv("CLOUDTALK_KEY_ID", "")
CLOUDTALK_API_SECRET = os.getenv("CLOUDTALK_API_SECRET", "")


def get_current_user():  # noqa: D103 - replace with your auth dependency
    raise NotImplementedError("Wire this router to your existing get_current_user dependency")


@router.get("/calls")
async def list_cloudtalk_calls(
    date_from: str | None = None,
    date_to: str | None = None,
    user_id: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    page: int = Query(1, ge=1),
    current_user: Any = Depends(get_current_user),
):
    if not CLOUDTALK_KEY_ID or not CLOUDTALK_API_SECRET:
        raise HTTPException(status_code=503, detail="CloudTalk integration is not configured")

    params: dict[str, Any] = {"limit": limit, "page": page}
    if date_from:
        params["date_from"] = date_from
    if date_to:
        params["date_to"] = date_to

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{CLOUDTALK_API_BASE}/calls/index.json",
            params=params,
            auth=(CLOUDTALK_KEY_ID, CLOUDTALK_API_SECRET),
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    body = response.json()
    response_data = body.get("responseData", body)
    data = response_data.get("data", [])

    role = getattr(current_user, "role", None)
    can_see_all = role in {"super_admin", "sales_manager"}
    if not can_see_all and user_id and getattr(current_user, "id", None) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if not can_see_all:
        user_email = str(getattr(current_user, "email", "")).lower()
        agents_response = await httpx.AsyncClient(timeout=30.0).get(
            f"{CLOUDTALK_API_BASE}/agents/index.json",
            params={"limit": 1000, "page": 1},
            auth=(CLOUDTALK_KEY_ID, CLOUDTALK_API_SECRET),
        )
        agent_ids = set()
        if agents_response.status_code < 400:
            agents_body = agents_response.json().get("responseData", {})
            for item in agents_body.get("data", []):
                agent = item.get("Agent", {})
                if str(agent.get("email", "")).lower() == user_email:
                    agent_ids.add(str(agent.get("id")))

        data = [
            item for item in data
            if str((item.get("Cdr") or {}).get("user_id")) in agent_ids
        ]

    return {
        "data": data,
        "meta": {
            "items_count": response_data.get("itemsCount", len(data)),
            "page": response_data.get("pageNumber", page),
            "page_size": response_data.get("limit", limit),
        },
    }
