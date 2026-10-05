#!/usr/bin/env python3
"""
Simplified code AST parser for AI Wikipedia.
Extracts code structure (functions, classes, imports) from source files.
"""

import json
from pathlib import Path
from typing import Dict, Any, List

def extract_code_info(file_path: str) -> Dict[str, Any]:
    """Extract structural information from code files."""
    path = Path(file_path)
    
    if not path.exists():
        return {
            'text': '',
            'metadata': {},
            'format': 'code',
            'success': False,
            'error': f'File not found: {file_path}'
        }
    
    ext = path.suffix.lower()
    language = get_language(ext)
    
    try:
        content = path.read_text(encoding='utf-8', errors='ignore')
        
        result = {
            'text': content,
            'metadata': {
                'filename': path.name,
                'language': language,
                'size': path.stat().st_size,
                'lines': content.count('\n') + 1,
                'functions': [],
                'classes': [],
                'imports': [],
            },
            'format': 'code',
            'success': True,
            'error': ''
        }
        
        # Simple pattern matching for common languages
        if language == 'python':
            extract_python_info(content, result['metadata'])
        elif language in ('javascript', 'typescript'):
            extract_js_ts_info(content, result['metadata'])
        elif language == 'java':
            extract_java_info(content, result['metadata'])
        elif language in ('c', 'cpp', 'c++'):
            extract_cpp_info(content, result['metadata'])
        elif language == 'rust':
            extract_rust_info(content, result['metadata'])
        elif language == 'go':
            extract_go_info(content, result['metadata'])
        
        # Limit text size
        if len(result['text']) > 50000:
            result['text'] = result['text'][:50000] + '\n\n[Truncated - file too large]'
        
        return result
        
    except Exception as e:
        return {
            'text': '',
            'metadata': {'language': language},
            'format': 'code',
            'success': False,
            'error': str(e)
        }

def get_language(ext: str) -> str:
    """Map file extension to language name."""
    mapping = {
        '.py': 'python', '.pyw': 'python',
        '.js': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.java': 'java',
        '.c': 'c', '.h': 'c',
        '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
        '.rs': 'rust',
        '.go': 'go',
        '.cs': 'csharp',
        '.php': 'php',
        '.lua': 'lua',
    }
    return mapping.get(ext, 'unknown')

def extract_python_info(content: str, meta: Dict[str, Any]):
    """Extract Python code structure."""
    import re
    # Find function definitions
    for match in re.finditer(r'^\s*def\s+(\w+)\s*\(', content, re.MULTILINE):
        meta['functions'].append({
            'name': match.group(1),
            'line': content[:match.start()].count('\n') + 1
        })
    
    # Find class definitions
    for match in re.finditer(r'^\s*class\s+(\w+)', content, re.MULTILINE):
        meta['classes'].append({
            'name': match.group(1),
            'line': content[:match.start()].count('\n') + 1
        })
    
    # Find imports
    for match in re.finditer(r'^(?:from\s+\S+\s+)?import\s+(\S+)', content, re.MULTILINE):
        meta['imports'].append(match.group(1))

def extract_js_ts_info(content: str, meta: Dict[str, Any]):
    """Extract JavaScript/TypeScript code structure."""
    import re
    # Find function definitions
    for match in re.finditer(r'(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))', content):
        name = match.group(1) or match.group(2)
        if name:
            meta['functions'].append({'name': name})
    
    # Find class definitions
    for match in re.finditer(r'class\s+(\w+)', content):
        meta['classes'].append({'name': match.group(1)})
    
    # Find imports
    for match in re.finditer(r'import\s+(?:{[^}]+}|\w+)\s+from\s+[\'"]([^\'"]+)[\'"]', content):
        meta['imports'].append(match.group(2))

def extract_java_info(content: str, meta: Dict[str, Any]):
    """Extract Java code structure."""
    import re
    # Find method definitions
    for match in re.finditer(r'(?:public|private|protected)?\s+\w+\s+(\w+)\s*\(', content):
        meta['functions'].append({'name': match.group(1)})
    
    # Find class definitions
    for match in re.finditer(r'(?:public\s+)?class\s+(\w+)', content):
        meta['classes'].append({'name': match.group(1)})

def extract_cpp_info(content: str, meta: Dict[str, Any]):
    """Extract C/C++ code structure."""
    import re
    # Find function definitions
    for match in re.finditer(r'\w+\s+(\w+)\s*\([^)]*\)\s*{', content):
        meta['functions'].append({'name': match.group(1)})
    
    # Find class/struct definitions
    for match in re.finditer(r'(?:class|struct)\s+(\w+)', content):
        meta['classes'].append({'name': match.group(1)})

def extract_rust_info(content: str, meta: Dict[str, Any]):
    """Extract Rust code structure."""
    import re
    # Find function definitions
    for match in re.finditer(r'fn\s+(\w+)', content):
        meta['functions'].append({'name': match.group(1)})
    
    # Find struct/trait/enum definitions
    for match in re.finditer(r'(?:struct|trait|enum)\s+(\w+)', content):
        meta['classes'].append({'name': match.group(1)})

def extract_go_info(content: str, meta: Dict[str, Any]):
    """Extract Go code structure."""
    import re
    # Find function definitions
    for match in re.finditer(r'func\s+(\w+)', content):
        meta['functions'].append({'name': match.group(1)})
    
    # Find type/struct definitions
    for match in re.finditer(r'type\s+(\w+)', content):
        meta['classes'].append({'name': match.group(1)})

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python code_parser.py <file_path>'}))
        sys.exit(1)
    
    result = extract_code_info(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
