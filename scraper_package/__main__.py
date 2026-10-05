"""
Main entry point for the consolidated scraper package.
Replaces the original scraper.py, scraper_advanced.py, scraper_gui.py, scraper_multi.py.
"""

import sys
import json
from .utils import create_argument_parser, export_articles
from .multisource import MultiSourceScraper


def main():
    parser = create_argument_parser()
    args = parser.parse_args()
    
    scraper = MultiSourceScraper(rate_limit=args.delay)
    all_articles = []
    
    print("=" * 50)
    print("AI Wikipedia - Consolidated Scraper v2.0")
    print("=" * 50)
    print(f"Source: {args.source}")
    print(f"Output: {args.output}")
    if args.verbose:
        print(f"Rate limit: {args.delay}s")
    print("-" * 50)
    
    if args.source == "wikipedia":
        if args.titles:
            titles = scraper.scrape_from_file(args.titles)
        elif args.query:
            titles = [args.query]
        else:
            titles = [f"Article_{i}" for i in range(args.limit)]
        
        print(f"Fetching {len(titles)} Wikipedia articles...")
        articles = scraper.scrape_wikipedia(titles)
        all_articles.extend(articles)
    
    elif args.source == "lex.dk":
        if not args.query:
            print("Error: --query required for lex.dk")
            sys.exit(1)
        print(f"Searching Lex.dk for: {args.query}")
        articles = scraper.scrape_lex_dk(args.query, args.limit)
        all_articles.extend(articles)
    
    elif args.source == "website":
        if not args.url:
            print("Error: --url required for website scraping")
            sys.exit(1)
        
        print(f"Scraping website: {args.url}")
        articles = scraper.scrape_website(args.url, args.crawl_depth, args.max_pages)
        all_articles.extend(articles)
    
    elif args.source == "file":
        if not args.titles:
            print("Error: --titles required for file mode")
            sys.exit(1)
        
        items = scraper.scrape_from_file(args.titles)
        print(f"Processing {len(items)} items...")
        
        for item in items:
            if item.startswith('http://') or item.startswith('https://'):
                scraped = scraper.scrape_website(item, args.crawl_depth, args.max_pages)
                all_articles.extend(scraped)
            else:
                scraped = scraper.scrape_wikipedia([item])
                all_articles.extend(scraped)
    
    # Convert and export
    print("-" * 50)
    print(f"Total scraped: {len(all_articles)} articles")
    
    export_articles(all_articles, args.output, args.source)
    print(f"\nSaved: {args.output}")
    print("Import in AI Wikipedia: Export/Sync > Import from JSON")


if __name__ == "__main__":
    main()
