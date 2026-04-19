import asyncio
import json
import logging
from datetime import date
from typing import Optional

import httpx
from pydantic import BaseModel

from bot.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Tu es un assistant de classification de dépenses pour un budget familial marocain.
Analyse le message et retourne UNIQUEMENT un tableau JSON valide.

RÈGLE CRITIQUE : Si le message contient plusieurs dépenses (séparées par des virgules, des sauts de ligne, "et", "plus", etc.), chaque dépense DOIT être un objet séparé dans le tableau. Ne jamais ignorer une dépense.

Exemple pour "Big Mac 86\nBouteille d'eau 8" :
[
  {"amount": 86, "currency": "MAD", "category": "restauration", "subcategory": null, "description": "Big Mac", "paid_by": "unknown", "paid_for": "both", "date": "YYYY-MM-DD", "confidence": 0.95},
  {"amount": 8, "currency": "MAD", "category": "alimentation", "subcategory": null, "description": "Bouteille d'eau", "paid_by": "unknown", "paid_for": "both", "date": "YYYY-MM-DD", "confidence": 0.95}
]

Exemple pour "café 20 MAD et taxi 50 MAD" :
[
  {"amount": 20, "currency": "MAD", "category": "restauration", "subcategory": null, "description": "café", "paid_by": "unknown", "paid_for": "both", "date": "YYYY-MM-DD", "confidence": 0.95},
  {"amount": 50, "currency": "MAD", "category": "transport", "subcategory": null, "description": "taxi", "paid_by": "unknown", "paid_for": "both", "date": "YYYY-MM-DD", "confidence": 0.95}
]

Champs pour chaque dépense :
{
  "amount": <nombre décimal>,
  "currency": "<MAD|EUR|USD>",
  "category": "<catégorie>",
  "subcategory": "<sous-catégorie ou null>",
  "description": "<description courte>",
  "paid_by": "<brahim|wife|unknown>",
  "paid_for": "<brahim|wife|both>",
  "date": "<YYYY-MM-DD>",
  "confidence": <0.0 à 1.0>
}

Catégories disponibles : alimentation, restauration, transport, logement, sante, loisirs, habillement, education, services, autre

Règles :
- Si le montant n'est pas clairement mentionné, confidence < 0.5
- currency par défaut : MAD
- date par défaut : aujourd'hui
- paid_for par défaut : both
- paid_by : déduis du contexte ou mets "unknown"
- Réponds UNIQUEMENT avec le tableau JSON, aucun texte avant ou après"""


class ParsedExpense(BaseModel):
    amount: float
    currency: str = "MAD"
    category: str
    subcategory: Optional[str] = None
    description: str
    paid_by: str
    paid_for: str = "both"
    date: str
    confidence: float


MODELS = [
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
]


def _format_message(message: str) -> str:
    lines = [l.strip() for l in message.strip().splitlines() if l.strip()]
    if len(lines) > 1:
        return "\n".join(f"Dépense {i + 1}: {line}" for i, line in enumerate(lines))
    return message


async def classify_expenses(message: str, today: date) -> list[ParsedExpense]:
    user_prompt = f"Date d'aujourd'hui : {today.isoformat()}\n\nMessage :\n{_format_message(message)}"

    for attempt in range(3):
        for model in MODELS:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.openrouter_api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://github.com/home-budget-agent",
                            "X-Title": "Home Budget Agent",
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user", "content": user_prompt},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 600,
                        },
                    )
                    if response.status_code == 429:
                        await asyncio.sleep(3 * (attempt + 1))
                        continue
                    if not response.is_success:
                        print(f"[classifier] {model} → {response.status_code}: {response.text}")
                        continue
                    data = response.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    logger.info(f"[classifier] {model} raw response: {content}")
                    if content.startswith("```"):
                        content = "\n".join(content.split("\n")[1:-1])
                    parsed = json.loads(content)
                    if isinstance(parsed, dict):
                        parsed = [parsed]
                    expenses = [ParsedExpense(**item) for item in parsed]
                    logger.info(f"[classifier] parsed {len(expenses)} expense(s)")
                    return expenses
            except Exception as e:
                print(f"[classifier] {model} attempt {attempt} → {e}")
                continue

    raise RuntimeError("Classification impossible après plusieurs tentatives.")
