#!/usr/bin/env python3
"""
Simplified ZIP parser for AI Wikipedia.
Extracts and parses ZIP archive contents.
"""

import json
import zipfile
import tempfile
from pathlib import Path
from typing import Dict, Any

def parse_zip(file_path: str) -> Dict[str, Any]:
    """Parse a ZIP file and extract contents."""
    path = Path(file_path)
    
    if not path.exists():
        return {
            'text': '',
            'metadata': {},
            'format': 'zip',
            'success': False,
            'error': f'File not found: {file_path}'
        }
    
    try:
        text_parts = []
        metadata = {
            'filename': path.name,
            'size': path.stat().st_size,
            'files': [],
        }
        
        with zipfile.ZipFile(path, 'r') as zip_ref:
            file_list = zip_ref.namelist()
            metadata['file_count'] = len(file_list)
            
            # Extract and read text files
            for file_name in file_list:
                if file_name.endswith('/'):
                    continue  # Skip directories
                
                # ZipSlip: reject paths that escape the extraction root
                target = Path(file_name)
                if target.is_absolute() or '..' in target.parts:
                    metadata['files'].append({
                        'name': file_name,
                        'error': 'Skipped: path traversal detected'
                    })
                    continue
                
                try:
                    # Check if it's a text file
                    ext = Path(file_name).suffix.lower()
                    text_exts = {'.txt', '.md', '.py', '.js', '.ts', '.java', '.c', '.cpp', 
                                 '.html', '.css', '.json', '.xml', '.csv', '.log'}
                    
                    if ext in text_exts:
                        content = zip_ref.read(file_name).decode('utf-8', errors='ignore')
                        text_parts.append(f'\n\n=== {file_name} ===\n{content[:5000]}')
                        if len(content) > 5000:
                            text_parts.append('[Truncated]')
                    
                    metadata['files'].append({
                        'name': file_name,
                        'size': zip_ref.getinfo(file_name).file_size,
                        'is_text': ext in text_exts
                    })
                    
                except Exception as e:
                    metadata['files'].append({
                        'name': file_name,
                        'error': str(e)
                    })
        
        return {
            'text': '\n'.join(text_parts),
            'metadata': metadata,
            'format': 'zip',
            'success': True,
            'error': ''
        }
        
    except zipfile.BadZipFile:
        return {
            'text': '',
            'metadata': {},
            'format': 'zip',
            'success': False,
            'error': 'Not a valid ZIP file'
        }
    except Exception as e:
        return {
            'text': '',
            'metadata': {},
            'format': 'zip',
            'success': False,
            'error': str(e)
        }

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python zip_parser.py <file_path>'}))
        sys.exit(1)
    
    result = parse_zip(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
