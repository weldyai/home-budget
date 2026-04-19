import json
from datetime import date

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from bot.classifier import classify_expenses, ParsedExpense
from bot.config import settings
from bot.database import save_expense

_allowed_ids = settings.get_allowed_ids()
BRAHIM_ID = _allowed_ids[0] if _allowed_ids else None


def _get_paid_by(user_id: int) -> str:
    if not BRAHIM_ID:
        return "unknown"
    return "brahim" if user_id == BRAHIM_ID else "wife"


def _format_expense_preview(expense: ParsedExpense) -> str:
    lines = [
        f"Montant : {expense.amount} {expense.currency}",
        f"Categorie : {expense.category}",
    ]
    if expense.subcategory:
        lines.append(f"Sous-categorie : {expense.subcategory}")
    lines += [
        f"Description : {expense.description}",
        f"Paye par : {expense.paid_by}",
        f"Pour : {expense.paid_for}",
        f"Date : {expense.date}",
    ]
    return "\n".join(lines)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id

    if user_id not in settings.get_allowed_ids():
        return

    text = update.message.text
    if not text:
        return

    await update.message.chat.send_action("typing")

    try:
        expenses = await classify_expenses(text, date.today())
    except Exception as e:
        await update.message.reply_text(f"Erreur de classification : {e}")
        return

    for expense in expenses:
        expense.paid_by = _get_paid_by(user_id) if expense.paid_by == "unknown" else expense.paid_by

    saved = []
    for expense in expenses:
        if expense.confidence > 0.7:
            try:
                await save_expense(expense, text)
                saved.append(expense)
            except Exception as e:
                await update.message.reply_text(f"Erreur d'enregistrement : {e}")
        else:
            expense_json = expense.model_dump_json()
            keyboard = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("Confirmer", callback_data=f"confirm:{expense_json}"),
                    InlineKeyboardButton("Annuler", callback_data="cancel"),
                ]
            ])
            await update.message.reply_text(
                f"Confiance faible ({expense.confidence:.0%}). Confirmer cette depense ?\n\n"
                f"{_format_expense_preview(expense)}",
                reply_markup=keyboard,
            )

    if saved:
        if len(saved) == 1:
            await update.message.reply_text(
                f"Depense enregistree :\n{_format_expense_preview(saved[0])}"
            )
        else:
            lines = [f"{len(saved)} depenses enregistrees :"]
            for i, exp in enumerate(saved, 1):
                lines.append(f"\n#{i} {_format_expense_preview(exp)}")
            await update.message.reply_text("\n".join(lines))


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    if query.data == "cancel":
        await query.edit_message_text("Depense annulee.")
        return

    if query.data.startswith("confirm:"):
        raw_json = query.data[len("confirm:"):]
        try:
            expense = ParsedExpense.model_validate_json(raw_json)
            await save_expense(expense, "")
            await query.edit_message_text(
                f"Depense confirmee et enregistree :\n{_format_expense_preview(expense)}"
            )
        except Exception as e:
            await query.edit_message_text(f"Erreur : {e}")
