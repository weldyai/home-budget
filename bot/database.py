from datetime import date
from typing import Optional

from supabase import create_client, Client

from bot.config import settings
from bot.classifier import ParsedExpense

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client


async def save_expense(expense: ParsedExpense, raw_message: str) -> dict:
    client = get_client()
    row = {
        "amount": expense.amount,
        "currency": expense.currency,
        "category": expense.category,
        "subcategory": expense.subcategory,
        "description": expense.description,
        "paid_by": expense.paid_by,
        "paid_for": expense.paid_for,
        "date": expense.date,
        "raw_message": raw_message,
        "confidence": expense.confidence,
    }
    result = client.table("expenses").insert(row).execute()
    return result.data[0]


async def get_monthly_summary(month: str) -> list[dict]:
    client = get_client()
    result = (
        client.table("expenses")
        .select("category, amount")
        .gte("date", f"{month}-01")
        .lte("date", f"{month}-31")
        .execute()
    )
    summary: dict[str, float] = {}
    for row in result.data:
        cat = row["category"]
        summary[cat] = summary.get(cat, 0) + float(row["amount"])
    return [{"category": k, "total": v} for k, v in sorted(summary.items(), key=lambda x: -x[1])]


async def get_recent_expenses(limit: int = 10) -> list[dict]:
    client = get_client()
    result = (
        client.table("expenses")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


async def get_monthly_total(month: str) -> float:
    client = get_client()
    result = (
        client.table("expenses")
        .select("amount")
        .gte("date", f"{month}-01")
        .lte("date", f"{month}-31")
        .execute()
    )
    return sum(float(row["amount"]) for row in result.data)


async def get_budget_alerts(month: str) -> list[dict]:
    client = get_client()
    expenses = await get_monthly_summary(month)
    budgets_result = (
        client.table("budgets")
        .select("*")
        .eq("month", month)
        .execute()
    )
    budgets = {b["category"]: b["limit_amount"] for b in budgets_result.data}

    alerts = []
    for item in expenses:
        cat = item["category"]
        if cat in budgets:
            pct = item["total"] / float(budgets[cat]) * 100
            if pct >= 80:
                alerts.append({
                    "category": cat,
                    "spent": item["total"],
                    "limit": float(budgets[cat]),
                    "percent": round(pct, 1),
                })
    return alerts
