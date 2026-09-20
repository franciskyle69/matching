import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class MatchingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'matching'

    def ready(self):
        """Eagerly load the XGBoost model at server startup.

        This ensures model I/O (joblib.load) happens once during
        initialization rather than on the first API request, eliminating
        ~50-200ms of latency from the critical path.
        """
        try:
            from matching.services import _get_model
            model, meta = _get_model()
            if model is not None:
                logger.info(
                    "XGBoost model loaded at startup (features=%s)",
                    len(meta.get("feature_names", [])) if meta else "?",
                )
            else:
                logger.warning(
                    "XGBoost model not available — using heuristic scoring fallback."
                )
        except Exception as exc:
            logger.warning(
                "Could not pre-load XGBoost model at startup: %s", exc
            )
