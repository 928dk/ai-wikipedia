"""
Utility functions for article conversion and formatting.
"""

import json
from datetime import datetime
from typing import Dict


def article_to_wiki_format(source_article: Dict) -> Dict:
    """Convert scraped article to AI Wikipedia format."""
    content = source_article.get("content", "")
    source = source_article.get("source", "unknown")
    images = source_article.get("images", [])
    
    return {
        "id": abs(hash(source_article.get("title", ""))) % 999999999,
        "title": source_article.get("title", "Untitled"),
        "content": content,
        "summary": content[:500] + "..." if len(content) > 500 else content,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "verification_status": "verified" if source in ["wikipedia", "lex.dk"] else "unverified",
        "confidence_score": 0.95 if source in ["wikipedia", "lex.dk"] else 0.7,
        "citations": json.dumps([{
            "source": source,
            "url": source_article.get("url", ""),
            "accessed": datetime.now().isoformat()
        }]),
        "images": images
    }


def export_articles(articles: List[Dict], output_file: str, source: str = "unknown"):
    """Export scraped articles to JSON file."""
    from typing import List
    
    # Convert to wiki format
    wiki_articles = [article_to_wiki_format(a) for a in articles]
    
    export = {
        "version": "2.0.0",
        "exported": datetime.now().isoformat(),
        "source": source,
        "count": len(wiki_articles),
        "articles": wiki_articles
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
    
    print(f"Saved {len(wiki_articles)} articles to: {output_file}")
    print("Import in AI Wikipedia: Export/Sync > Import from JSON")


def create_argument_parser():
    """Create CLI argument parser for scraper."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="AI Wikipedia Scraper v2.0 - Consolidated Multi-Source Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Wikipedia
  python3 -m scraper_package --source wikipedia --query "Python"
  
  # Lex.dk (Danish)
  python3 -m scraper_package --source lex.dk --query "Danmark"
  
  # Website
  python3 -m scraper_package --source website --url "https://example.com"
  
  # File input
  python3 -m scraper_package --source file --titles my_articles.txt
        """
    )
    
    parser.add_argument("--source", choices=["wikipedia", "lex.dk", "website", "file", "all"],
                       default="wikipedia", help="Data source")
    parser.add_argument("--query", help="Search query")
    parser.add_argument("--url", help="Website URL to scrape")
    parser.add_argument("--titles", help="File with titles/URLs (one per line)")
    parser.add_argument("--limit", type=int, default=50, help="Number of articles")
    parser.add_argument("--output", "-o", default="scraped_export.json")
    parser.add_argument("--delay", type=float, default=0.5, help="Rate limit delay (seconds)")
    parser.add_argument("--crawl-depth", type=int, default=0, help="Crawl depth (0=single page)")
    parser.add_argument("--max-pages", type=int, default=20, help="Max pages to crawl")
    parser.add_argument("--selenium", action="store_true", help="Use headless browser")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    return parser
