from whitenoise.storage import CompressedManifestStaticFilesStorage

# Source / toolchain files that are not browser CSS. WhiteNoise's hasher
# treats `@import "tailwindcss"` as a missing static file and fails the build.
_SKIP_POSTPROCESS_NAMES = {
    "input.css",
}


class WhiteNoiseStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """Do not fail collectstatic when a CSS/JS reference is missing from disk."""

    manifest_strict = False

    def post_process(self, paths, dry_run=False, **kwargs):
        kept = {
            name: packed
            for name, packed in paths.items()
            if str(name).replace("\\", "/").rsplit("/", 1)[-1] not in _SKIP_POSTPROCESS_NAMES
        }
        yield from super().post_process(kept, dry_run=dry_run, **kwargs)
