#!/usr/bin/env python3
"""
HTML Mobile-Friendly Converter (No Dependencies)
Lightweight batch processor for HTML files - no external libraries required
"""

import os
import re
from pathlib import Path

MOBILE_CSS = '''    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 10px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .chapter-container { 
      max-width: 900px; 
      margin: 0 auto;
      line-height: 1.6;
    }
    img { 
      max-width: 100%; 
      height: auto; 
      display: block;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      overflow-x: auto;
      margin: 10px 0;
    }
    table, th, td { 
      border: 1px solid #ddd; 
      padding: 8px; 
    }
    details {
      margin-bottom: 10px;
    }
    summary {
      cursor: pointer;
      padding: 8px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }
    summary:hover {
      background-color: #e8e8e8;
    }
    
    /* Mobile optimization */
    @media (max-width: 768px) {
      body { 
        padding: 8px; 
        font-size: 14px; 
      }
      .chapter-container { 
        padding: 0; 
      }
      h1 { font-size: 1.3em; margin: 10px 0; }
      h2 { font-size: 1.1em; margin: 8px 0; }
      h3 { font-size: 1em; margin: 6px 0; }
      table { 
        font-size: 12px; 
      }
      table, th, td { 
        padding: 6px; 
      }
      summary {
        padding: 6px;
        font-size: 0.95em;
      }
      ul, ol {
        margin: 8px 0;
        padding-left: 15px;
      }
      li {
        margin: 4px 0;
      }
    }
    
    @media (max-width: 480px) {
      body { 
        padding: 6px; 
        font-size: 13px;
      }
      h1 { font-size: 1.1em; }
      h2 { font-size: 1em; }
      h3 { font-size: 0.95em; }
      summary {
        padding: 5px;
        font-size: 0.9em;
      }
      table, th, td { 
        padding: 4px;
        font-size: 11px;
      }
      .keyword {
        word-break: break-word;
      }
    }'''

def has_viewport_meta(content):
    """Check if viewport meta tag exists"""
    return bool(re.search(r'<meta\s+name\s*=\s*["\']viewport["\']', content, re.IGNORECASE))

def has_style_tag(content):
    """Check if style tag already has mobile CSS"""
    return 'max-width: 900px' in content or '@media (max-width:' in content

def add_viewport_meta(content):
    """Add viewport meta tag if not present"""
    if has_viewport_meta(content):
        return content, False
    
    # Find </head> and insert viewport meta before it
    head_close = re.search(r'</head>', content, re.IGNORECASE)
    if head_close:
        viewport = '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        content = content[:head_close.start()] + viewport + content[head_close.start():]
        return content, True
    
    return content, False

def add_mobile_css(content):
    """Add mobile-friendly CSS"""
    if has_style_tag(content):
        return content, False
    
    # Find </head> and insert style tag before it
    head_close = re.search(r'</head>', content, re.IGNORECASE)
    if head_close:
        style_tag = f'  <style>\n{MOBILE_CSS}\n  </style>\n'
        content = content[:head_close.start()] + style_tag + content[head_close.start():]
        return content, True
    
    return content, False

def process_html_file(file_path, backup=True):
    """
    Process a single HTML file
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        content = original_content
        changes = []
        
        # Add viewport meta
        content, changed = add_viewport_meta(content)
        if changed:
            changes.append("✓ Added viewport meta tag")
        else:
            changes.append("• Viewport meta tag already exists")
        
        # Add mobile CSS
        content, changed = add_mobile_css(content)
        if changed:
            changes.append("✓ Added responsive CSS")
        else:
            changes.append("• Mobile CSS already exists")
        
        # Create backup if content changed
        if backup and content != original_content:
            backup_path = file_path + '.backup'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            changes.append(f"✓ Backup: {Path(backup_path).name}")
        
        # Write updated content if changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            changes.append("✓ File updated")
        else:
            changes.append("• No changes needed")
        
        return True, "\n  ".join(changes)
    
    except Exception as e:
        return False, f"Error: {str(e)}"

def batch_process_directory(directory_path, pattern="*.html", backup=True):
    """Batch process all HTML files in directory"""
    dir_path = Path(directory_path)
    
    if not dir_path.exists():
        print(f"❌ Directory not found: {directory_path}")
        return
    
    # Find HTML files recursively
    html_files = list(dir_path.rglob(pattern))
    
    if not html_files:
        print(f"❌ No HTML files found matching '{pattern}'")
        return
    
    print(f"📁 Found {len(html_files)} HTML file(s)\n")
    
    success_count = 0
    failed_count = 0
    
    for file_path in sorted(html_files):
        rel_path = file_path.relative_to(dir_path)
        print(f"Processing: {rel_path}")
        
        success, message = process_html_file(str(file_path), backup=backup)
        
        if success:
            print(f"  {message}")
            success_count += 1
        else:
            print(f"  ❌ {message}")
            failed_count += 1
        print()
    
    # Summary
    print("=" * 60)
    print(f"✅ Success: {success_count} | ❌ Failed: {failed_count}")
    print("=" * 60)

def main():
    import sys
    
    print("=" * 60)
    print("🌐 HTML Mobile-Friendly Converter (No Dependencies)")
    print("=" * 60)
    print()
    
    if len(sys.argv) < 2:
        print("Usage: python make_mobile_friendly_lite.py <path> [--no-backup]")
        print()
        print("Examples:")
        print("  python make_mobile_friendly_lite.py ./output")
        print("  python make_mobile_friendly_lite.py file.html")
        print("  python make_mobile_friendly_lite.py ./output --no-backup")
        print()
        return
    
    target_path = sys.argv[1]
    backup = '--no-backup' not in sys.argv
    
    # Single file
    if target_path.endswith('.html') and os.path.isfile(target_path):
        print(f"Processing: {target_path}\n")
        success, message = process_html_file(target_path, backup=backup)
        
        if success:
            print(f"✅ {message}")
        else:
            print(f"❌ {message}")
    
    # Directory
    elif os.path.isdir(target_path):
        batch_process_directory(target_path, backup=backup)
    
    else:
        print(f"❌ Invalid path: {target_path}")

if __name__ == "__main__":
    main()
