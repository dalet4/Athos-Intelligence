"""Minimal OTLP/JSON span sender for TwoTail. No SDK dependency — raw HTTP POST."""
import os
import uuid
import requests

ENDPOINT = "https://www.twotail.ai/api/v1/traces"
SERVICE_NAME = "athos-intelligence-pipeline"


def new_trace_id():
    return uuid.uuid4().hex


def new_span_id():
    return uuid.uuid4().hex[:16]


def _attr(key, value):
    if isinstance(value, bool):
        return {"key": key, "value": {"boolValue": value}}
    if isinstance(value, int):
        return {"key": key, "value": {"intValue": value}}
    if isinstance(value, float):
        return {"key": key, "value": {"doubleValue": value}}
    return {"key": key, "value": {"stringValue": str(value)}}


def send_span(trace_id, span_id, parent_span_id, name, start_ns, end_ns, attributes=None, status_code=1):
    """Fire-and-forget. Never raises — a dead tracing backend must not break the pipeline."""
    api_key = os.getenv("TWOTAIL_API_KEY")
    if not api_key:
        return
    payload = {
        "resourceSpans": [{
            "resource": {"attributes": [_attr("service.name", SERVICE_NAME)]},
            "scopeSpans": [{
                "spans": [{
                    "traceId": trace_id,
                    "spanId": span_id,
                    "parentSpanId": parent_span_id,
                    "name": name,
                    "startTimeUnixNano": start_ns,
                    "endTimeUnixNano": end_ns,
                    "attributes": [_attr(k, v) for k, v in (attributes or {}).items()],
                    "status": {"code": status_code},
                }]
            }]
        }]
    }
    try:
        requests.post(ENDPOINT, json=payload, headers={"X-API-Key": api_key}, timeout=5)
    except Exception:
        pass
