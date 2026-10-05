#!/usr/bin/env python3
"""
Simplified document parsers for AI Wikipedia.
Extracts text content + metadata from various file formats.
Ported from OpenViking parsers but simplified for AI Wikipedia's needs.
"""

import json
import os
from pathlib import Path
from typing import Dict, Optional, Any

def extract_text(file_path: str, parser_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract text and metadata from a file.
    
    Args:
        file_path: Path to the file
        parser_type: Optional parser type override (pdf, docx, xlsx, pptx, epub, html, md, txt)
    
    Returns:
        Dict with: { 'text': str, 'metadata': dict, 'format': str, 'success': bool, 'error': str }
    """
    path = Path(file_path)
    
    if not path.exists():
        return { 'text': '', 'metadata': {}, 'format': '', 'success': False, 'error': f'File not found: {file_path}' }
    
    # Detect type from extension if not specified
    if not parser_type:
        ext = path.suffix.lower()
        type_map = {
            '.pdf': 'pdf',
            '.docx': 'docx', '.doc': 'doc',
            '.xlsx': 'xlsx', '.xls': 'xls',
            '.pptx': 'pptx', '.ppt': 'ppt',
            '.epub': 'epub',
            '.html': 'html', '.htm': 'html',
            '.md': 'md', '.markdown': 'md', '.mdown': 'md',
            '.txt': 'txt', '.text': 'txt',
        }
        parser_type = type_map.get(ext, 'txt')
    
    try:
        if parser_type == 'pdf':
            return parse_pdf(file_path)
        elif parser_type in ('docx', 'doc'):
            return parse_docx(file_path)
        elif parser_type in ('xlsx', 'xls'):
            return parse_excel(file_path)
        elif parser_type in ('pptx', 'ppt'):
            return parse_powerpoint(file_path)
        elif parser_type == 'epub':
            return parse_epub(file_path)
        elif parser_type == 'html':
            return parse_html(file_path)
        elif parser_type == 'md':
            return parse_markdown(file_path)
        else:
            return parse_text(file_path)
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': parser_type, 'success': False, 'error': str(e) }

def parse_text(file_path: str) -> Dict[str, Any]:
    """Parse plain text file."""
    path = Path(file_path)
    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
    
    content = ''
    for enc in encodings:
        try:
            content = path.read_text(encoding=enc)
            break
        except:
            continue
    
    return {
        'text': content,
        'metadata': {
            'filename': path.name,
            'size': path.stat().st_size,
            'lines': content.count('\n') + 1 if content else 0,
        },
        'format': 'text',
        'success': True,
        'error': '',
    }

def parse_pdf(file_path: str) -> Dict[str, Any]:
    """Parse PDF file using pdfplumber."""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text_parts = []
            metadata = {
                'filename': Path(file_path).name,
                'pages': len(pdf.pages),
                'size': Path(file_path).stat().st_size,
            }
            
            if pdf.metadata:
                metadata['pdf_info'] = {k: v for k, v in pdf.metadata.items() if v}
            
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            
            return {
                'text': '\n\n'.join(text_parts),
                'metadata': metadata,
                'format': 'pdf',
                'success': True,
                'error': '',
            }
    except ImportError:
        return { 'text': '', 'metadata': {}, 'format': 'pdf', 'success': False, 'error': 'pdfplumber not installed. Run: pip install pdfplumber' }
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': 'pdf', 'success': False, 'error': str(e) }

def parse_docx(file_path: str) -> Dict[str, Any]:
    """Parse Word document using python-docx."""
    try:
        import docx
        doc = docx.Document(file_path)
        
        text_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
        
        # Extract tables
        table_text = []
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text for cell in row.cells]
                table_text.append(' | '.join(row_text))
        
        all_text = '\n'.join(text_parts)
        if table_text:
            all_text += '\n\n## Tables\n' + '\n'.join(table_text)
        
        return {
            'text': all_text,
            'metadata': {
                'filename': Path(file_path).name,
                'size': Path(file_path).stat().st_size,
                'paragraphs': len(doc.paragraphs),
                'tables': len(doc.tables),
            },
            'format': 'docx',
            'success': True,
            'error': '',
        }
    except ImportError:
        return { 'text': '', 'metadata': {}, 'format': 'docx', 'success': False, 'error': 'python-docx not installed. Run: pip install python-docx' }
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': 'docx', 'success': False, 'error': str(e) }

def parse_excel(file_path: str) -> Dict[str, Any]:
    """Parse Excel file using openpyxl or xlrd."""
    try:
        from openpyxl import load_workbook
        wb = load_workbook(file_path, data_only=True)
        
        text_parts = []
        metadata = {
            'filename': Path(file_path).name,
            'size': Path(file_path).stat().st_size,
            'sheets': [],
        }
        
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            metadata['sheets'].append({ 'name': sheet_name, 'rows': sheet.max_row, 'cols': sheet.max_column })
            
            text_parts.append(f'\n\n# Sheet: {sheet_name}')
            for row in sheet.iter_rows(values_only=True):
                row_text = [str(cell) if cell is not None else '' for cell in row]
                if any(row_text):
                    text_parts.append(' | '.join(row_text))
        
        return {
            'text': '\n'.join(text_parts),
            'metadata': metadata,
            'format': 'xlsx',
            'success': True,
            'error': '',
        }
    except ImportError:
        return { 'text': '', 'metadata': {}, 'format': 'xlsx', 'success': False, 'error': 'openpyxl not installed. Run: pip install openpyxl' }
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': 'xlsx', 'success': False, 'error': str(e) }

def parse_powerpoint(file_path: str) -> Dict[str, Any]:
    """Parse PowerPoint file using python-pptx."""
    try:
        import pptx
        prs = pptx.Presentation(file_path)
        
        text_parts = []
        metadata = {
            'filename': Path(file_path).name,
            'size': Path(file_path).stat().st_size,
            'slides': len(prs.slides),
        }
        
        for idx, slide in enumerate(prs.slides):
            text_parts.append(f'\n\n## Slide {idx + 1}')
            for shape in slide.shapes:
                if hasattr(shape, 'text') and shape.text.strip():
                    text_parts.append(shape.text)
        
        return {
            'text': '\n'.join(text_parts),
            'metadata': metadata,
            'format': 'pptx',
            'success': True,
            'error': '',
        }
    except ImportError:
        return { 'text': '', 'metadata': {}, 'format': 'pptx', 'success': False, 'error': 'python-pptx not installed. Run: pip install python-pptx' }
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': 'pptx', 'success': False, 'error': str(e) }

def parse_epub(file_path: str) -> Dict[str, Any]:
    """Parse EPUB file."""
    try:
        import ebooklib
        from ebooklib import epub
        
        book = epub.read_epub(file_path)
        
        text_parts = []
        metadata = {
            'filename': Path(file_path).name,
            'size': Path(file_path).stat().st_size,
        }
        
        # Extract metadata
        for key, value in book.metadata.items():
            if value:
                metadata[f'meta_{key}'] = str(value)
        
        # Extract text from items
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                try:
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(item.get_content(), 'html.parser')
                    text = soup.get_text()
                    if text.strip():
                        text_parts.append(text)
                except:
                    text_parts.append(item.get_content().decode('utf-8', errors='ignore'))
        
        return {
            'text': '\n\n'.join(text_parts),
            'metadata': metadata,
            'format': 'epub',
            'success': True,
            'error': '',
        }
    except ImportError:
        return { 'text': '', 'metadata': {}, 'format': 'epub', 'success': False, 'error': 'ebooklib not installed. Run: pip install ebooklib beautifulsoup4' }
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': 'epub', 'success': False, 'error': str(e) }

def parse_html(file_path: str) -> Dict[str, Any]:
    """Parse HTML file."""
    try:
        from bs4 import BeautifulSoup
        
        path = Path(file_path)
        html_content = path.read_text(encoding='utf-8', errors='ignore')
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(['script', 'style', 'nav', 'footer', 'header']):
            script.decompose()
        
        text = soup.get_text(separator='\n')
        # Clean up whitespace
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        text = '\n'.join(lines)
        
        metadata = {
            'filename': path.name,
            'size': path.stat().st_size,
            'title': soup.title.string if soup.title else '',
        }
        
        return {
            'text': text[:50000],  # Limit to 50k chars
            'metadata': metadata,
            'format': 'html',
            'success': True,
            'error': '',
        }
    except ImportError:
        return { 'text': '', 'metadata': {}, 'format': 'html', 'success': False, 'error': 'beautifulsoup4 not installed. Run: pip install beautifulsoup4' }
    except Exception as e:
        return { 'text': '', 'metadata': {}, 'format': 'html', 'success': False, 'error': str(e) }

def parse_markdown(file_path: str) -> Dict[str, Any]:
    """Parse Markdown file."""
    path = Path(file_path)
    content = path.read_text(encoding='utf-8', errors='ignore')
    
    return {
        'text': content,
        'metadata': {
            'filename': path.name,
            'size': path.stat().st_size,
            'lines': content.count('\n') + 1,
        },
        'format': 'markdown',
        'success': True,
        'error': '',
    }

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print(json.dumps({ 'error': 'Usage: python document_parser.py <file_path> [parser_type]' }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    parser_type = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Auto-detect parser type if not specified
    if not parser_type:
        ext = Path(file_path).suffix.lower()
        type_map = {
            '.py': 'code', '.js': 'code', '.ts': 'code', '.tsx': 'code',
            '.java': 'code', '.c': 'code', '.cpp': 'code', '.rs': 'code', '.go': 'code',
            '.cs': 'code', '.php': 'code', '.lua': 'code',
            '.jpg': 'media', '.jpeg': 'media', '.png': 'media', '.gif': 'media',
            '.bmp': 'media', '.webp': 'media', '.mp3': 'media', '.wav': 'media',
            '.mp4': 'media', '.avi': 'media', '.mkv': 'media',
            '.zip': 'zip',
            '.doc': 'legacy_doc',
        }
        parser_type = type_map.get(ext, 'document')
    
    # Dispatch to appropriate parser
    if parser_type == 'code':
        from code_parser import extract_code_info
        result = extract_code_info(file_path)
    elif parser_type == 'media':
        from media_parser import extract_media_info
        result = extract_media_info(file_path)
    elif parser_type == 'zip':
        from zip_parser import parse_zip
        result = parse_zip(file_path)
    elif parser_type == 'legacy_doc':
        from legacy_doc_parser import parse_legacy_doc
        result = parse_legacy_doc(file_path)
    else:
        result = extract_text(file_path, parser_type)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
