"""
AI Wikipedia Scraper Package
Consolidated from: scraper.py, scraper_advanced.py, scraper_gui.py, scraper_multi.py

Usage:
    from scraper_package import WikipediaScraper, AdvancedScraper, MultiSourceScraper
    from scraper_package import ScraperGUI
"""

import importlib

from .core import ScraperCore, CredentialManager
from .wikipedia import WikipediaScraper
from .advanced import AdvancedScraper
from .multisource import MultiSourceScraper
from .utils import article_to_wiki_format

__version__ = "2.0.0"
__all__ = [
    'ScraperCore',
    'WikipediaScraper', 
    'AdvancedScraper',
    'MultiSourceScraper',
    'ScraperGUI',
    'article_to_wiki_format',
    'CredentialManager'
]

_LAZY_ATTRS = {"ScraperGUI": ("gui", "ScraperGUI")}


def __getattr__(name):
    """Lazily load heavy submodules (e.g. gui/tkinter) on first use.

    The GUI is only pulled in when actually requested, so importing the
    package for CLI use does not import tkinter, and running
    `python3 -m scraper_package.gui` no longer triggers the partial-import
    RuntimeWarning caused by an eager `from .gui import ScraperGUI`.
    """
    if name in _LAZY_ATTRS:
        module_name, attr_name = _LAZY_ATTRS[name]
        module = importlib.import_module(f".{module_name}", __name__)
        return getattr(module, attr_name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
