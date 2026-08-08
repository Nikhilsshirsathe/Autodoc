"""
TemplateLoader: Load and cache YAML section templates.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Optional

import yaml
from app.models.ipo.section_template import SectionTemplate

logger = logging.getLogger(__name__)


class TemplateLoader:
    """
    Loads and caches section templates from YAML files.
    Template directory: backend/templates/ipo/
    """

    def __init__(self, templates_dir: Optional[Path] = None):
        """
        Args:
            templates_dir: Path to templates directory. Defaults to backend/templates/ipo
        """
        if templates_dir is None:
            # Default: backend/templates/ipo (relative to this file)
            backend_root = Path(__file__).resolve().parents[3]  # backend/
            templates_dir = backend_root / "templates" / "ipo"

        self.templates_dir = templates_dir
        self._cache: dict[str, SectionTemplate] = {}
        logger.info(f"TemplateLoader initialized with templates_dir={self.templates_dir}")

    def load_template(self, section_id: str) -> SectionTemplate:
        """
        Load a single section template by its ID.
        Returns cached version if available.

        Args:
            section_id: Section identifier (e.g., "company-overview")

        Returns:
            SectionTemplate

        Raises:
            FileNotFoundError: If template file does not exist
            ValueError: If template YAML is invalid
        """
        if section_id in self._cache:
            return self._cache[section_id]

        yaml_path = self.templates_dir / f"{section_id}.yaml"
        if not yaml_path.exists():
            raise FileNotFoundError(f"Template not found: {yaml_path}")

        try:
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            # Parse and validate with Pydantic
            template = SectionTemplate(**data)
            self._cache[section_id] = template
            logger.debug(f"Loaded template: {section_id}")
            return template

        except Exception as exc:
            logger.error(f"Failed to load template {section_id}: {exc}", exc_info=True)
            raise ValueError(f"Invalid template {section_id}: {exc}") from exc

    def load_all_templates(self) -> list[SectionTemplate]:
        """
        Load all section templates from the templates directory.
        Returns them sorted by display_order.

        Returns:
            list[SectionTemplate]
        """
        templates: list[SectionTemplate] = []
        for yaml_file in self.templates_dir.glob("*.yaml"):
            section_id = yaml_file.stem
            # Skip generator scripts
            if section_id.startswith("generate_"):
                continue
            try:
                template = self.load_template(section_id)
                templates.append(template)
            except Exception as exc:
                logger.warning(f"Skipping invalid template {section_id}: {exc}")

        # Sort by display order
        templates.sort(key=lambda t: t.display_order)
        logger.info(f"Loaded {len(templates)} templates")
        return templates

    def get_template_metadata(self) -> list[dict]:
        """
        Return metadata (no prompt content) for all templates.
        Useful for returning template list to frontend.

        Returns:
            list[dict]: Each dict contains id, section_name, display_order, description, etc.
        """
        templates = self.load_all_templates()
        return [
            {
                "id": t.id,
                "section_name": t.section_name,
                "display_order": t.display_order,
                "description": t.description,
                "estimated_pages": t.estimated_pages,
                "dependencies": t.dependencies,
                "sebi_reference": t.sebi_reference,
            }
            for t in templates
        ]

    def get_prompt_template_content(self, section_id: str) -> str:
        """
        Load the prompt template file referenced by the section template.

        Args:
            section_id: Section ID

        Returns:
            str: Prompt template content

        Raises:
            FileNotFoundError: If prompt file not found
        """
        template = self.load_template(section_id)
        prompt_path = self.templates_dir / template.prompt_template_path

        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt template not found: {prompt_path}")

        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()

    def clear_cache(self):
        """Clear the template cache. Useful for testing or hot-reload."""
        self._cache.clear()
        logger.debug("Template cache cleared")
