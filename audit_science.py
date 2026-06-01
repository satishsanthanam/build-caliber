import os
import re

TARGET_DIR = "/home/opc/projects/github/build-caliber/science"

# Regex patterns to spot unformatted science markers
patterns = {
    "Flat Chemical Formulas": r'\b(H2O|CO2|NaOH|NaCl|HCl|H2SO4|CaCO3)\b',
    "Flat Ion Indicators": r'\b(H\+|OH\-|Na\+|Cl\-)\b',
    "Raw Text Reaction Arrows": r'(-->|->|=>)',
    "Flat Physics Units": r'\b(m/s2|cm2|m3|kg/m3)\b',
    "Markdown Table Remnants": r'(\|---|---\||\|)'
}

def audit_files():
    if not os.path.exists(TARGET_DIR):
        print(f"Error: Path {TARGET_DIR} not found.")
        return

    print(f"Scanning all HTML files under: {TARGET_DIR}\n" + "="*50)
    total_errors = 0

    for root, _, files in os.walk(TARGET_DIR):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, TARGET_DIR)
                
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                found_in_file = []
                for name, regex in patterns.items():
                    if re.search(regex, content):
                        found_in_file.append(name)
                
                if found_in_file:
                    print(f"⚠️ [ERROR FOUND] inside: science/{relative_path}")
                    for issue in found_in_file:
                        print(f"   -> Detected: {issue}")
                    print("-" * 50)
                    total_errors += 1

    print(f"Audit Complete. Found formatting anomalies in {total_errors} files.")

if __name__ == "__main__":
    audit_files()
