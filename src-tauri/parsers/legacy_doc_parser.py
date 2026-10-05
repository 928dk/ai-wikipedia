#!/usr/bin/env python3
"""
Simplified legacy doc parser for AI Wikipedia.
Handles old .doc files using antiword or catdoc.
"""

import json
from pathlib import Path
from typing import Dict, Any

def parse_legacy_doc(file_path: str) -> Dict[str, Any]:
    """Parse legacy .doc files."""
    path = Path(file_path)
    
    if not path.exists():
        return {
            'text': '',
            'metadata': {},
            'format': 'doc',
            'success': False,
            'error': f'File not found: {file_path}'
        }
    
    text = ''
    metadata = {
        'filename': path.name,
        'size': path.stat().st_size,
    }
    
    # Try antiword first
    try:
        import subprocess
        result = subprocess.run(
            ['antiword', str(path)],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            text = result.stdout
            metadata['method'] = 'antiword'
        else:
            raise Exception('antiword failed')
    except (FileNotFoundError, Exception):
        # Try catdoc as fallback
        try:
            result = subprocess.run(
                ['catdoc', str(path)],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                text = result.stdout
                metadata['method'] = 'catdoc'
            else:
                raise Exception('catdoc failed')
        except (FileNotFoundError, Exception):
            # Last resort: try python-docx (might work for some .doc files)
            try:
                import docx
                doc = docx.Document(str(path))
                text_parts = [para.text for para in doc.paragraphs if para.text.strip()]
                text = '\n'.join(text_parts)
                metadata['method'] = 'python-docx'
            except ImportError:
                return {
                    'text': '',
                    'metadata': metadata,
                    'format': 'doc',
                    'success': False,
                    'error': 'No .doc parser available. Install: apt install antiword catdoc (Linux) or pip install python-docx'
                }
            except Exception as e:
                return {
                    'text': '',
                    'metadata': metadata,
                    'format': 'doc',
                    'success': False,
                    'error': f'python-docx failed: {str(e)}. Try installing antiword or catdoc.'
                }
    
    return {
        'text': text,
        'metadata': metadata,
        'format': 'doc',
        'success': True,
        'error': ''
    }

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python legacy_doc_parser.py <file_path>'}))
        sys.exit(1)
    
    result = parse_legacy_doc(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
