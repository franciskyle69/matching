from whitenoise.storage import CompressedManifestStaticFilesStorage


class WhiteNoiseStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """Do not fail collectstatic when a CSS/JS reference is missing from disk."""

    manifest_strict = False
