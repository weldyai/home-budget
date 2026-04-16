import asyncio
import json
from datetime import date
from typing import Optional

import httpx
from pydantic import BaseModel

from bot.config import settings

SYSTEM_PROMPT = """Tu es un assistant de classification de dépenses pour un budget familial marocain.
Analyse le message et retourne UNIQUEMENT un objet JSON valide avec ces champs :

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
- Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après"""


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


async def classify_expense(message: str, today: date) -> ParsedExpense:
    user_prompt = f"Date d'aujourd'hui : {today.isoformat()}\n\nMessage : {message}"

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
                            "max_tokens": 300,
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
                    if content.startswith("```"):
                        content = "\n".join(content.split("\n")[1:-1])
                    return ParsedExpense(**json.loads(content))
            except Exception as e:
                print(f"[classifier] {model} attempt {attempt} → {e}")
                continue

    raise RuntimeError("Classification impossible après plusieurs tentatives.")
