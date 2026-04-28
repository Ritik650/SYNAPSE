"""Shared Claude client wrapper for all Synapse intelligence calls."""
import json
import re
from pathlib import Path
from typing import Any
from jinja2 import Environment, FileSystemLoader
import anthropic
from ..core.config import get_settings

settings = get_settings()

_client: anthropic.Anthropic | None = None
PROMPTS_DIR = Path(__file__).parent / "prompts"
MODEL = "claude-haiku-4-5-20251001"
SAFETY_FOOTER = (
    "\n\n---\n*Synapse is informational only and is not a medical device. "
    "Always consult a licensed clinician for medical decisions.*"
)


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def load_prompt(template_name: str, **kwargs: Any) -> str:
    """Load a Jinja2 prompt template from prompts/ and render it."""
    env = Environment(
        loader=FileSystemLoader(str(PROMPTS_DIR)),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template(template_name)
    return template.render(**kwargs)


def call_claude(
    system: str,
    user_message: str,
    max_tokens: int = 2048,
    expect_json: bool = False,
) -> str:
    """Single-turn Claude call with retry on JSON parse failure."""
    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    )
    content = response.content[0].text

    if expect_json:
        # Strip markdown code fences if present
        content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
        content = re.sub(r"\s*```$", "", content.strip(), flags=re.MULTILINE)

    return content


def call_claude_json(
    system: str,
    user_message: str,
    max_tokens: int = 2048,
) -> dict | list:
    """Claude call that guarantees a parsed JSON return value."""
    raw = call_claude(system, user_message, max_tokens=max_tokens, expect_json=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to extract first JSON block
        match = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", raw)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Claude returned non-JSON: {raw[:300]}")


def call_claude_vision(
    system: str,
    user_message: str,
    image_data: bytes,
    media_type: str = "image/jpeg",
    max_tokens: int = 2048,
    expect_json: bool = True,
) -> dict | str:
    """Claude vision call with an image attachment."""
    import base64

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.standard_b64encode(image_data).decode("utf-8"),
                        },
                    },
                    {"type": "text", "text": user_message},
                ],
            }
        ],
    )
    content = response.content[0].text

    if expect_json:
        content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
        content = re.sub(r"\s*```$", "", content.strip(), flags=re.MULTILINE)
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", content)
            if match:
                return json.loads(match.group())
    return content


async def ping_claude() -> str:
    """Health check — returns 'ready' if Claude API responds."""
    result = call_claude(
        system="You are a health check endpoint. Reply only with the single word 'ready'.",
        user_message="ping",
        max_tokens=10,
    )
    return result.strip().lower()
