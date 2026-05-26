# HTML Mobile-Friendly Converter

A Python script to batch process your existing HTML files and add mobile responsiveness.

## Features

✅ Adds viewport meta tag for proper mobile rendering  
✅ Injects responsive CSS with media queries (768px, 480px breakpoints)  
✅ Preserves all existing HTML content and structure  
✅ Creates automatic backups of original files  
✅ Batch processes entire directories or single files  
✅ Works with MathJax and complex nested structures  

## Installation

### Requirements
```bash
pip install beautifulsoup4
```

## Usage

### Single File
```bash
python make_mobile_friendly.py /path/to/file.html
```

### Entire Directory
```bash
python make_mobile_friendly.py /path/to/html/directory
```

### Skip Backups (not recommended)
```bash
python make_mobile_friendly.py /path/to/directory --no-backup
```

## Examples

**Process a single chapter file:**
```bash
python make_mobile_friendly.py ./output/math/class-10/coordinate-geometry.html
```

**Process all HTML files in output folder:**
```bash
python make_mobile_friendly.py ./output
```

**Process with no backups:**
```bash
python make_mobile_friendly.py ./output --no-backup
```

## What Gets Added

### 1. Viewport Meta Tag
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 2. Responsive CSS
- **Desktop (768px+)**: Full layout with normal spacing
- **Tablet (≤768px)**: Reduced font sizes, optimized padding
- **Mobile (≤480px)**: Compact layout with minimal spacing

The CSS includes:
- Flexible images and tables
- Readable font stacks (system fonts)
- Touch-friendly spacing
- Proper heading hierarchy
- Better contrast and readability

## Output

- ✅ Updates files in-place
- 📦 Creates `.backup` files for each processed HTML
- 📝 Provides detailed processing log with changes made

## What's Preserved

✅ All your existing content  
✅ MathJax configuration  
✅ CSS references (`<link rel="stylesheet">`)  
✅ JavaScript functionality  
✅ Custom classes and IDs  
✅ Chapter structure and formatting  

## Tips

1. **Run on a test copy first** - process one file to verify output
2. **Review backups** - check `.backup` files if something looks odd
3. **Test on devices** - view processed files on mobile devices
4. **Keep original CSS** - this script only adds viewport + additional responsive CSS

## Troubleshooting

**"No HTML files found"**
- Ensure files have `.html` extension
- Check directory path is correct

**"pip install beautifulsoup4" fails**
- Update pip: `pip install --upgrade pip`
- Try with Python 3: `pip3 install beautifulsoup4`

**Files look malformed after processing**
- Check the `.backup` file to restore original
- BeautifulSoup sometimes reformats whitespace - this is normal and doesn't affect functionality

## Notes

- The script uses BeautifulSoup's `prettify()` which may reformat HTML structure (adds proper indentation)
- All functionality and content is preserved - only formatting/spacing may change
- Safe to run multiple times on same files (detects existing viewport meta and won't duplicate)
