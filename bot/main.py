import logging

from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)

from bot.config import settings
from bot.handlers.expense import handle_message, handle_callback
from bot.handlers.report import report_command, summary_command

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main() -> None:
    app = Application.builder().token(settings.telegram_token).build()

    app.add_handler(CommandHandler("report", report_command))
    app.add_handler(CommandHandler("summary", summary_command))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot started, polling...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
