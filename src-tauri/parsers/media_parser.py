#!/usr/bin/env python3
"""
Simplified media parser for AI Wikipedia.
Extracts metadata from image, audio, and video files.
"""

import json
from pathlib import Path
from typing import Dict, Any

def extract_image_info(file_path: str) -> Dict[str, Any]:
    """Extract image metadata."""
    path = Path(file_path)
    
    if not path.exists():
        return {
            'text': '',
            'metadata': {},
            'format': 'image',
            'success': False,
            'error': f'File not found: {file_path}'
        }
    
    result = {
        'text': f'Image: {path.name}',
        'metadata': {
            'filename': path.name,
            'size': path.stat().st_size,
            'format': path.suffix.lower().replace('.', ''),
        },
        'format': 'image',
        'success': True,
        'error': ''
    }
    
    try:
        from PIL import Image
        with Image.open(path) as img:
            result['metadata']['width'] = img.width
            result['metadata']['height'] = img.height
            result['metadata']['mode'] = img.mode
            
            # Try to get EXIF data
            if hasattr(img, '_getexif'):
                try:
                    exif = img._getexif()
                    if exif:
                        result['metadata']['exif'] = {str(k): str(v) for k, v in exif.items()}
                except:
                    pass
    except ImportError:
        result['metadata']['note'] = 'PIL/Pillow not installed - limited metadata'
    except Exception as e:
        result['metadata']['pil_error'] = str(e)
    
    return result

def extract_audio_info(file_path: str) -> Dict[str, Any]:
    """Extract audio metadata."""
    path = Path(file_path)
    
    if not path.exists():
        return {
            'text': '',
            'metadata': {},
            'format': 'audio',
            'success': False,
            'error': f'File not found: {file_path}'
        }
    
    result = {
        'text': f'Audio: {path.name}',
        'metadata': {
            'filename': path.name,
            'size': path.stat().st_size,
            'format': path.suffix.lower().replace('.', ''),
        },
        'format': 'audio',
        'success': True,
        'error': ''
    }
    
    try:
        from pydub.utils import mediainfo
        info = mediainfo(path)
        if info:
            result['metadata']['duration'] = info.get('duration', '')
            result['metadata']['bitrate'] = info.get('bitrate', '')
            result['metadata']['sample_rate'] = info.get('sample_rate', '')
    except ImportError:
        result['metadata']['note'] = 'pydub not installed - limited metadata'
    except Exception as e:
        result['metadata']['mediainfo_error'] = str(e)
    
    return result

def extract_video_info(file_path: str) -> Dict[str, Any]:
    """Extract video metadata."""
    path = Path(file_path)
    
    if not path.exists():
        return {
            'text': '',
            'metadata': {},
            'format': 'video',
            'success': False,
            'error': f'File not found: {file_path}'
        }
    
    result = {
        'text': f'Video: {path.name}',
        'metadata': {
            'filename': path.name,
            'size': path.stat().st_size,
            'format': path.suffix.lower().replace('.', ''),
        },
        'format': 'video',
        'success': True,
        'error': ''
    }
    
    try:
        from pydub.utils import mediainfo
        info = mediainfo(path)
        if info:
            result['metadata']['duration'] = info.get('duration', '')
            result['metadata']['width'] = info.get('width', '')
            result['metadata']['height'] = info.get('height', '')
            result['metadata']['fps'] = info.get('fps', '')
    except ImportError:
        result['metadata']['note'] = 'pydub not installed - limited metadata'
    except Exception as e:
        result['metadata']['mediainfo_error'] = str(e)
    
    return result

def extract_media_info(file_path: str) -> Dict[str, Any]:
    """Auto-detect media type and extract metadata."""
    path = Path(file_path)
    ext = path.suffix.lower()
    
    image_exts = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'}
    audio_exts = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'}
    video_exts = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'}
    
    if ext in image_exts:
        return extract_image_info(file_path)
    elif ext in audio_exts:
        return extract_audio_info(file_path)
    elif ext in video_exts:
        return extract_video_info(file_path)
    else:
        return {
            'text': '',
            'metadata': {'extension': ext},
            'format': 'media',
            'success': False,
            'error': f'Unsupported media type: {ext}'
        }

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python media_parser.py <file_path>'}))
        sys.exit(1)
    
    result = extract_media_info(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
