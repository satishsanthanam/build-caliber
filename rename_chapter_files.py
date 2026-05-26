#!/usr/bin/env python3
"""
Rename existing HTML chapter files from old format to new format
Old: subject/class/chapter-title.html
New: subject/class/02-chapter-title.html (with leading zero chapter numbers)
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict

def parse_html_for_chapter_info(file_path):
    """
    Parse HTML file to extract chapter number and title
    Looks for patterns like "Chapter 7:" or <h1>Chapter 7: Title</h1>
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Look for chapter info in HTML (e.g., "Chapter 7: Coordinate Geometry")
        chapter_pattern = r'[Cc]hapter\s+(\d+)[:\s]+([^<\n]+)'
        match = re.search(chapter_pattern, content)
        
        if match:
            chapter_no = int(match.group(1))
            chapter_title = match.group(2).strip()
            return chapter_no, chapter_title
        
        return None, None
    except Exception as e:
        print(f"  ⚠️ Could not parse: {str(e)}")
        return None, None

def sanitize_filename(text):
    """Convert text to URL-safe filename"""
    result = text.lower().replace(' ', '-')
    result = re.sub(r'[^a-z0-9-]', '', result)
    result = re.sub(r'-+', '-', result).strip('-')
    return result

def get_old_filename(file_path):
    """Extract old filename without path"""
    return Path(file_path).name

def generate_new_filename(chapter_no, chapter_title):
    """Generate new filename with chapter number prefix"""
    if chapter_no is None or chapter_no == 999:
        sanitized = chapter_title.lower().replace(' ', '-')
        sanitized = re.sub(r'[^a-z0-9-]', '', sanitized)
        sanitized = re.sub(r'-+', '-', sanitized).strip('-')
        return f"{sanitized}.html"
    else:
        sanitized = chapter_title.lower().replace(' ', '-')
        sanitized = re.sub(r'[^a-z0-9-]', '', sanitized)
        sanitized = re.sub(r'-+', '-', sanitized).strip('-')
        chapter_str = str(chapter_no).zfill(2)
        return f"{chapter_str}-{sanitized}.html"

def scan_directory(root_dir):
    """
    Scan directory for HTML files and prepare rename mappings
    Returns list of (old_path, new_path, chapter_no, title) tuples
    """
    mappings = []
    
    for html_file in Path(root_dir).rglob('*.html'):
        # Skip index.html files
        if html_file.name == 'index.html':
            continue
        
        print(f"Scanning: {html_file.relative_to(root_dir)}")
        chapter_no, chapter_title = parse_html_for_chapter_info(str(html_file))
        
        if chapter_no is not None and chapter_title:
            new_filename = generate_new_filename(chapter_no, chapter_title)
            old_filename = get_old_filename(str(html_file))
            
            # Only add if names differ
            if old_filename != new_filename:
                new_path = html_file.parent / new_filename
                mappings.append({
                    'old_path': html_file,
                    'new_path': new_path,
                    'old_name': old_filename,
                    'new_name': new_filename,
                    'chapter_no': chapter_no,
                    'title': chapter_title
                })
                print(f"  ✓ Found: Chapter {chapter_no}: {chapter_title}")
        else:
            print(f"  ✗ Could not extract chapter info")
    
    return mappings

def preview_changes(mappings):
    """Show what files will be renamed"""
    print("\n" + "="*70)
    print("📋 RENAME PREVIEW")
    print("="*70 + "\n")
    
    if not mappings:
        print("No files to rename.")
        return
    
    for mapping in mappings:
        rel_old = mapping['old_path'].relative_to(mapping['old_path'].parent.parent.parent)
        rel_new = mapping['new_path'].relative_to(mapping['new_path'].parent.parent.parent)
        
        print(f"Chapter {mapping['chapter_no']}: {mapping['title']}")
        print(f"  OLD: {mapping['old_name']}")
        print(f"  NEW: {mapping['new_name']}")
        print()
    
    print(f"Total files to rename: {len(mappings)}\n")

def perform_rename(mappings, dry_run=False):
    """Actually rename the files"""
    print("="*70)
    if dry_run:
        print("🏃 DRY RUN MODE (no changes will be made)")
    else:
        print("🔄 PERFORMING RENAMES")
    print("="*70 + "\n")
    
    success_count = 0
    error_count = 0
    
    for mapping in mappings:
        old_path = mapping['old_path']
        new_path = mapping['new_path']
        
        try:
            if dry_run:
                print(f"[DRY RUN] Would rename:")
                print(f"  {mapping['old_name']} → {mapping['new_name']}")
                success_count += 1
            else:
                # Check if new file already exists
                if new_path.exists():
                    print(f"⚠️ SKIPPED (already exists): {new_path.name}")
                    error_count += 1
                else:
                    old_path.rename(new_path)
                    print(f"✅ RENAMED: {mapping['old_name']} → {mapping['new_name']}")
                    success_count += 1
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            error_count += 1
    
    print("\n" + "="*70)
    print(f"✅ Success: {success_count} | ❌ Failed: {error_count}")
    print("="*70)

def generate_index_html(root_dir, dry_run=False):
    """Scans subdirectories and generates a fresh index.html based on actual files"""
    print("\n" + "="*70)
    print(f"📂 GENERATING INDEX: {root_dir}/index.html")
    print("="*70 + "\n")

    subjects_data = defaultdict(lambda: defaultdict(list))
    
    # Scan all HTML files
    for html_file in sorted(Path(root_dir).rglob('*.html')):
        if html_file.name == 'index.html':
            continue
        
        rel_path = html_file.relative_to(root_dir)
        parts = rel_path.parts
        
        if len(parts) < 3: # Expecting subject/class/file.html
            continue
            
        subject = parts[0].capitalize()
        # Format "class-10" to "Class 10"
        class_name = parts[1].replace('-', ' ').title()
        
        chapter_no, chapter_title = parse_html_for_chapter_info(str(html_file))
        
        # Fallback if parsing failed
        if not chapter_title:
            chapter_title = html_file.stem.replace('-', ' ').title()
        
        href = rel_path.as_posix()
        sort_key = chapter_no if chapter_no is not None else 999
        
        subjects_data[subject][class_name].append({
            'no': chapter_no,
            'title': chapter_title,
            'href': href,
            'sort_key': sort_key
        })

    if not subjects_data:
        print("⚠️ No content files found to index.")
        return

    html_lines = ["<h1>Build Calibre Dashboard</h1>\n"]
    for subj in sorted(subjects_data.keys()):
        html_lines.append(f"\n<h2>{subj}</h2>\n")
        classes = subjects_data[subj]
        for cls in sorted(classes.keys()):
            html_lines.append(f"<h3>{cls}</h3>\n<ul>\n")
            # Sort chapters by chapter number
            chapters = sorted(classes[cls], key=lambda x: x['sort_key'])
            for chap in chapters:
                if chap['no'] is not None:
                    display = f"Chapter {chap['no']}: {chap['title']}"
                else:
                    display = chap['title']
                html_lines.append(f'  <li><a href="{chap["href"]}">{display}</a></li>\n')
            html_lines.append("</ul>\n")

    if dry_run:
        print(f"[DRY RUN] Would write new index.html with {sum(len(c) for s in subjects_data.values() for c in s.values())} links.")
    else:
        index_path = Path(root_dir) / "index.html"
        with open(index_path, 'w', encoding='utf-8') as f:
            f.writelines(html_lines)
        print(f"✅ Successfully created new index.html")

def main():
    if len(sys.argv) < 2:
        print("="*70)
        print("📄 HTML Chapter File Renamer")
        print("="*70)
        print("\nUsage: python rename_chapter_files.py <directory> [--dry-run]")
        print("\nExamples:")
        print("  python rename_chapter_files.py ./output --dry-run")
        print("  python rename_chapter_files.py ./output")
        print("\nOptions:")
        print("  --dry-run    Preview changes without renaming")
        print("\nDescription:")
        print("  Renames HTML files from: polynomials.html")
        print("  To new format:           02-polynomials.html")
        print("  Uses chapter number from HTML content")
        print()
        return
    
    target_dir = Path(sys.argv[1]).resolve()
    dry_run = '--dry-run' in sys.argv
    
    # Validate directory
    if not os.path.isdir(target_dir):
        print(f"❌ Directory not found: {target_dir}")
        return
    
    print("="*70)
    print(f"📁 Scanning directory: {target_dir}")
    print("="*70 + "\n")
    
    # Scan and collect mappings
    mappings = scan_directory(target_dir)
    
    if mappings:
        # Preview changes
        preview_changes(mappings)
        
        # Ask for confirmation (unless dry-run)
        if not dry_run:
            response = input("Proceed with renaming? (yes/no): ").strip().lower()
            if response in ['yes', 'y']:
                perform_rename(mappings, dry_run=dry_run)
            else:
                print("Renaming cancelled.")
        else:
            perform_rename(mappings, dry_run=True)
    else:
        print("\n✨ No files need renaming (already follow the new format).")

    # Always offer to rebuild index.html
    if not dry_run:
        response = input("\nRebuild index.html by scanning all folders? (yes/no): ").strip().lower()
        if response in ['yes', 'y']:
            generate_index_html(target_dir, dry_run=False)
    else:
        generate_index_html(target_dir, dry_run=True)

if __name__ == "__main__":
    main()

