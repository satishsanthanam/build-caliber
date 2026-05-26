#!/usr/bin/env python3
"""
HTML Mobile-Friendly Converter
Batch processes HTML files to add mobile responsiveness
"""

import os
import re
from pathlib import Path
from bs4 import BeautifulSoup

def add_viewport_meta(soup):
    """Add viewport meta tag if it doesn't exist"""
    head = soup.find('head')
    if head:
        # Check if viewport meta already exists
        viewport = head.find('meta', attrs={'name': 'viewport'})
        if not viewport:
            meta = soup.new_tag('meta', attrs={
                'name': 'viewport',
                'content': 'width=device-width, initial-scale=1.0'
            })
            # Insert after charset meta
            charset = head.find('meta', attrs={'charset': True})
            if charset:
                charset.insert_after(meta)
            else:
                head.insert(0, meta)
            return True
    return False

def add_mobile_css(soup):
    """Add mobile-friendly CSS styles"""
    head = soup.find('head')
    if not head:
        return False
    
    mobile_css = """    * { box-sizing: border-box; }
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
    }"""
    
    # Create style tag
    style_tag = soup.new_tag('style')
    style_tag.string = mobile_css
    
    # Insert before closing head tag
    head.append(style_tag)
    return True

def process_html_file(file_path, backup=True):
    """
    Process a single HTML file to make it mobile-friendly
    
    Args:
        file_path: Path to HTML file
        backup: Whether to create a backup of original file
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        # Read original file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        
        # Track changes
        changes = []
        
        # Add viewport meta tag
        if add_viewport_meta(soup):
            changes.append("✓ Added viewport meta tag")
        else:
            changes.append("• Viewport meta tag already exists")
        
        # Add mobile CSS
        if add_mobile_css(soup):
            changes.append("✓ Added responsive CSS")
        
        # Create backup if requested
        if backup:
            backup_path = file_path + '.backup'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
            changes.append(f"✓ Backup created: {backup_path}")
        
        # Write updated content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify()))
        
        changes.append("✓ File updated successfully")
        return True, "\n  ".join(changes)
    
    except Exception as e:
        return False, f"Error: {str(e)}"

def batch_process_directory(directory_path, pattern="*.html", backup=True):
    """
    Batch process all HTML files in a directory
    
    Args:
        directory_path: Path to directory containing HTML files
        pattern: File pattern to match (default: *.html)
        backup: Whether to create backups
    """
    dir_path = Path(directory_path)
    
    if not dir_path.exists():
        print(f"❌ Directory not found: {directory_path}")
        return
    
    html_files = list(dir_path.glob(pattern))
    
    if not html_files:
        print(f"❌ No HTML files found matching pattern '{pattern}' in {directory_path}")
        return
    
    print(f"📁 Found {len(html_files)} HTML file(s) to process\n")
    
    success_count = 0
    failed_count = 0
    
    for file_path in sorted(html_files):
        print(f"Processing: {file_path.name}")
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
    print(f"✅ Successfully processed: {success_count}")
    print(f"❌ Failed: {failed_count}")
    print("=" * 60)

def main():
    import sys
    
    print("=" * 60)
    print("🌐 HTML Mobile-Friendly Converter")
    print("=" * 60)
    print()
    
    # Check for command line arguments
    if len(sys.argv) < 2:
        print("Usage: python make_mobile_friendly.py <directory_or_file> [--no-backup]")
        print()
        print("Examples:")
        print("  python make_mobile_friendly.py /path/to/html/files")
        print("  python make_mobile_friendly.py /path/to/file.html")
        print("  python make_mobile_friendly.py ./output --no-backup")
        print()
        print("Options:")
        print("  --no-backup    Skip creating backup files")
        print()
        return
    
    target_path = sys.argv[1]
    backup = '--no-backup' not in sys.argv
    
    # Check if it's a file or directory
    if target_path.endswith('.html') and os.path.isfile(target_path):
        # Single file
        print(f"Processing single file: {target_path}\n")
        success, message = process_html_file(target_path, backup=backup)
        
        if success:
            print(f"✅ Success:\n  {message}")
        else:
            print(f"❌ Failed:\n  {message}")
    else:
        # Directory
        if os.path.isdir(target_path):
            batch_process_directory(target_path, backup=backup)
        else:
            print(f"❌ Invalid path: {target_path}")
            print("Please provide a valid file or directory path")

if __name__ == "__main__":
    main()
