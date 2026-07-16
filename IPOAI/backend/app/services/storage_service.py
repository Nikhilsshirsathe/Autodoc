"""
Supabase Storage service — upload, download, delete files.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import StorageError
from app.db.session import get_supabase_admin

logger = logging.getLogger(__name__)


class StorageService:
    """Wraps Supabase Storage operations."""

    def __init__(self):
        self.bucket = settings.STORAGE_BUCKET

    @property
    def _client(self):
        return get_supabase_admin()

    def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        user_id: str,
    ) -> str:
        """
        Upload a file to Supabase Storage.

        Returns the storage path (e.g., "user_id/uuid-filename.pdf").
        """
        ext = Path(filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        storage_path = f"{user_id}/{unique_name}"

        try:
            self._client.storage.from_(self.bucket).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": mime_type, "upsert": "false"},
            )
            return storage_path
        except Exception as exc:
            raise StorageError(f"Upload failed: {exc}") from exc

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Get a signed (temporary) public URL for a file."""
        try:
            res = self._client.storage.from_(self.bucket).create_signed_url(
                path=storage_path,
                expires_in=expires_in,
            )
            return res["signedURL"]
        except Exception as exc:
            raise StorageError(f"Failed to get signed URL: {exc}") from exc

    def download_file(self, storage_path: str) -> bytes:
        """Download a file from Supabase Storage and return its bytes."""
        try:
            data = self._client.storage.from_(self.bucket).download(storage_path)
            return data
        except Exception as exc:
            raise StorageError(f"Download failed: {exc}") from exc

    def delete_file(self, storage_path: str) -> None:
        """Delete a file from Supabase Storage."""
        try:
            self._client.storage.from_(self.bucket).remove([storage_path])
        except Exception as exc:
            raise StorageError(f"Delete failed: {exc}") from exc
