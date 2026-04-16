from datetime import date

from telegram import Update
from telegram.ext import ContextTypes

from bot.config import settings
from bot.database import get_monthly_summary, get_monthly_total, get_recent_expenses, get_budget_alerts


def _current_month() -> str:
    return date.today().strftime("%Y-%m")


async def report_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id not in settings.get_allowed_ids():
        return

    month = context.args[0] if context.args else _current_month()

    try:
        total = await get_monthly_total(month)
        summary = await get_monthly_summary(month)
        alerts = await get_budget_alerts(month)
    except Exception as e:
        await update.message.reply_text(f"Erreur : {e}")
        return

    lines = [f"Rapport {month}", f"Total : {total:.2f} MAD", ""]

    if summary:
        lines.append("Par categorie :")
        for item in summary:
            pct = item["total"] / total * 100 if total else 0
            lines.append(f"  {item['category']} : {item['total']:.2f} MAD ({pct:.0f}%)")
    else:
        lines.append("Aucune depense ce mois.")

    if alerts:
        lines.append("")
        lines.append("Alertes budget :")
        for alert in alerts:
            lines.append(
                f"  {alert['category']} : {alert['spent']:.2f}/{alert['limit']:.2f} MAD ({alert['percent']}%)"
            )

    await update.message.reply_text("\n".join(lines))


async def summary_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_user.id not in settings.get_allowed_ids():
        return

    try:
        expenses = await get_recent_expenses(10)
    except Exception as e:
        await update.message.reply_text(f"Erreur : {e}")
        return

    if not expenses:
        await update.message.reply_text("Aucune depense enregistree.")
        return

    lines = ["10 dernieres depenses :"]
    for exp in expenses:
        lines.append(
            f"  {exp['date']} | {exp['amount']} {exp['currency']} | {exp['category']} | {exp['description']}"
        )

    await update.message.reply_text("\n".join(lines))
