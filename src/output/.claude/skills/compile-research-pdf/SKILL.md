---
name: compile-research-pdf
description: Compiles all research markdown files from the current project into a comprehensive, professionally-formatted PDF report with table of contents, cover page, and proper styling
tools: Read, Write, Bash
model: claude-sonnet-4-5
---

# PDF Research Compilation Skill

This skill automatically compiles all research markdown files from your project folder into a single, professionally-formatted PDF document.

## What This Skill Does

1. **Detects all markdown files** in the current project directory (excluding `00_INTAKE_BRIEF.md`, summaries, and "start here" files)
2. **Generates a Python script** that:
   - Reads all markdown files in the correct order
   - Converts markdown to HTML with proper table/code/formatting support
   - Applies professional CSS styling (headers, tables, code blocks, page breaks)
   - Creates a cover page with project details
   - Generates a table of contents
   - Outputs a complete PDF report
3. **Executes the script** to produce the final PDF

## How to Use

Simply invoke this skill when you're ready to compile your research into a PDF:

```
/compile-research-pdf
```

The skill will automatically:
- Find all markdown files in your working directory (starting from `01_Foundation/`, NOT `00_INTAKE_BRIEF.md`)
- **IMPORTANT: The `00_INTAKE_BRIEF.md` file is EXCLUDED because it contains raw JSON data**
- Create a properly formatted PDF with all content
- Save it as `[ProjectName]_Complete_Research_Report.pdf`

## Requirements

- Python 3 with `weasyprint` and `markdown` libraries installed
- Markdown files following standard naming conventions (numbered sections)
- Working directory set to the project folder

## Output

- **PDF File**: `[ProjectName]_Complete_Research_Report.pdf` in your project directory
- **HTML Debug File**: `COMPLETE_RESEARCH_REPORT.html` (for debugging if needed)

## Instructions for AI Agent

When this skill is activated:

1. **Identify the current working directory** - This should be your project folder (e.g., `output/Projects/BrandName_Date_ProductName`)

2. **Find all markdown files** in the directory and subdirectories:
   - Use `ls -R` or similar to list all `.md` files
   - **EXCLUDE `00_INTAKE_BRIEF.md`** - This file contains raw JSON data and should NOT be included in the PDF
   - Exclude files named `PROJECT_SUMMARY.md`, `START_HERE*.md`, `SCRIPTS_SUMMARY.md`, or similar summary files
   - Include the complete script file: `06_Scripts/FINAL_SCRIPTS.md` (contains all 35 scripts)
   - Identify the correct order (usually numbered: 01_, 02_, etc.) - start from 01_Foundation, NOT 00_

3. **Extract project metadata** from the intake brief or folder name:
   - Brand name
   - Product name
   - Campaign goal/details
   - Date

4. **Create the PDF compilation script** at the project root with this structure:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compile multiple markdown files into a single comprehensive PDF
"""

import os
import sys
import markdown
from weasyprint import HTML, CSS
from pathlib import Path

# Force UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Define the project directory and files in order
project_dir = r"[REPLACE_WITH_PROJECT_PATH]"
output_file = os.path.join(project_dir, "[REPLACE_WITH_OUTPUT_FILENAME].pdf")

# Files in specific order
# IMPORTANT: Do NOT include 00_INTAKE_BRIEF.md - it contains raw JSON data
markdown_files = [
    # [REPLACE_WITH_FILE_LIST]
    # Example (start from 01_, NOT 00_):
    # "01_Foundation/foundation_analysis.md",
    # "02_Audience/audience_intelligence.md",
    # "03_Content/content_performance.md",
    # "04_Competitive/competitive_intelligence.md",
    # "05_Synthesis/strategic_synthesis.md",
    # "06_Scripts/FINAL_SCRIPTS.md",
]

# Custom CSS for better PDF formatting
custom_css = CSS(string="""
    @page {
        size: letter;
        margin: 1in;
        @bottom-center {
            content: "Page " counter(page) " of " counter(pages);
            font-size: 9pt;
            color: #666;
        }
    }

    body {
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #333;
    }

    h1 {
        font-size: 24pt;
        font-weight: bold;
        margin-top: 24pt;
        margin-bottom: 12pt;
        page-break-before: always;
        color: #1a1a1a;
        border-bottom: 2px solid #333;
        padding-bottom: 8pt;
    }

    h1:first-of-type {
        page-break-before: auto;
    }

    h2 {
        font-size: 18pt;
        font-weight: bold;
        margin-top: 18pt;
        margin-bottom: 10pt;
        color: #2a2a2a;
    }

    h3 {
        font-size: 14pt;
        font-weight: bold;
        margin-top: 14pt;
        margin-bottom: 8pt;
        color: #3a3a3a;
    }

    h4, h5, h6 {
        font-size: 12pt;
        font-weight: bold;
        margin-top: 12pt;
        margin-bottom: 6pt;
        color: #4a4a4a;
    }

    p {
        margin-bottom: 10pt;
        text-align: justify;
    }

    ul, ol {
        margin-left: 20pt;
        margin-bottom: 10pt;
    }

    li {
        margin-bottom: 5pt;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin: 15pt 0;
        font-size: 10pt;
    }

    th, td {
        border: 1px solid #ddd;
        padding: 8pt;
        text-align: left;
    }

    th {
        background-color: #f2f2f2;
        font-weight: bold;
    }

    code {
        font-family: 'Courier New', monospace;
        background-color: #f5f5f5;
        padding: 2pt 4pt;
        border-radius: 3pt;
        font-size: 9pt;
    }

    pre {
        background-color: #f5f5f5;
        padding: 10pt;
        border-radius: 5pt;
        overflow-x: auto;
        margin: 10pt 0;
        border-left: 3px solid #666;
    }

    pre code {
        background-color: transparent;
        padding: 0;
    }

    blockquote {
        border-left: 4px solid #ccc;
        padding-left: 15pt;
        margin-left: 0;
        color: #666;
        font-style: italic;
    }

    hr {
        border: none;
        border-top: 1px solid #ccc;
        margin: 20pt 0;
    }

    a {
        color: #0066cc;
        text-decoration: none;
    }

    .page-break {
        page-break-after: always;
    }

    .toc {
        page-break-after: always;
    }

    .toc h1 {
        page-break-before: auto;
    }

    .toc ul {
        list-style-type: none;
        margin-left: 0;
    }

    .toc li {
        margin-bottom: 8pt;
    }
""")

def create_table_of_contents(files):
    """Generate a table of contents"""
    toc_html = """
    <div class="toc">
        <h1>Table of Contents</h1>
        <ul>
    """

    file_titles = {
        # [REPLACE_WITH_FILE_TITLES_MAPPING]
    }

    for i, file in enumerate(files, 1):
        title = file_titles.get(file, file.replace('.md', '').replace('-', ' ').replace('_', ' ').title())
        toc_html += f"        <li>{i}. {title}</li>\n"

    toc_html += """
        </ul>
    </div>
    """
    return toc_html

def compile_markdown_to_pdf():
    """Main function to compile all markdown files into one PDF"""

    print(f"Starting PDF compilation...")
    print(f"Project directory: {project_dir}")

    # Initialize markdown converter with extensions
    md = markdown.Markdown(extensions=[
        'tables',
        'fenced_code',
        'codehilite',
        'nl2br',
        'sane_lists',
        'toc'
    ])

    # Build the complete HTML content
    html_parts = []

    # Add HTML header
    html_parts.append("""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>[REPLACE_WITH_TITLE]</title>
    </head>
    <body>
    """)

    # Add cover page
    html_parts.append("""
    <div style="text-align: center; margin-top: 200pt;">
        <h1 style="font-size: 36pt; border: none; page-break-before: auto;">[REPLACE_BRAND_NAME]</h1>
        <h2 style="font-size: 24pt; color: #666;">[REPLACE_PRODUCT_NAME]</h2>
        <p style="font-size: 14pt; margin-top: 50pt;">Complete Campaign Research & Strategy Report</p>
        <p style="font-size: 12pt; color: #666; margin-top: 30pt;">[REPLACE_CAMPAIGN_DETAILS]</p>
        <p style="font-size: 11pt; color: #999; margin-top: 20pt;">[REPLACE_DATE]</p>
    </div>
    <div class="page-break"></div>
    """)

    # Add table of contents
    html_parts.append(create_table_of_contents(markdown_files))

    # Process each markdown file
    for i, filename in enumerate(markdown_files, 1):
        filepath = os.path.join(project_dir, filename)

        print(f"Processing {i}/{len(markdown_files)}: {filename}")

        if not os.path.exists(filepath):
            print(f"  WARNING: File not found: {filepath}")
            continue

        try:
            # Read the markdown file with proper encoding
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                md_content = f.read()

            # Convert markdown to HTML
            html_content = md.convert(md_content)

            # Add the HTML content
            html_parts.append(html_content)

            # Reset the markdown converter for next file
            md.reset()

            print(f"  [OK] Processed successfully")

        except Exception as e:
            print(f"  ERROR processing {filename}: {str(e)}")
            continue

    # Close HTML
    html_parts.append("""
    </body>
    </html>
    """)

    # Combine all HTML parts
    full_html = "\n".join(html_parts)

    # Write HTML to file for debugging
    html_path = os.path.join(project_dir, "COMPLETE_RESEARCH_REPORT.html")
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(full_html)
    print(f"\nHTML file created: {html_path}")

    # Generate PDF
    print(f"\nGenerating PDF: {output_file}")
    try:
        HTML(string=full_html).write_pdf(
            output_file,
            stylesheets=[custom_css]
        )
        print(f"[SUCCESS] PDF generated successfully!")
        print(f"  Location: {output_file}")

        # Get file size
        file_size = os.path.getsize(output_file)
        size_mb = file_size / (1024 * 1024)
        print(f"  Size: {size_mb:.2f} MB")

    except Exception as e:
        print(f"ERROR generating PDF: {str(e)}")
        raise

if __name__ == "__main__":
    compile_markdown_to_pdf()
```

5. **Fill in the template placeholders**:
   - `[REPLACE_WITH_PROJECT_PATH]`: Full path to project directory
   - `[REPLACE_WITH_OUTPUT_FILENAME]`: e.g., "BrandName_Complete_Research_Report"
   - `[REPLACE_WITH_FILE_LIST]`: List of all markdown files in order
   - `[REPLACE_WITH_FILE_TITLES_MAPPING]`: Dictionary mapping filenames to readable titles
   - `[REPLACE_WITH_TITLE]`: PDF document title
   - `[REPLACE_BRAND_NAME]`: Brand name for cover page
   - `[REPLACE_PRODUCT_NAME]`: Product name for cover page
   - `[REPLACE_CAMPAIGN_DETAILS]`: Campaign details/goal
   - `[REPLACE_DATE]`: Current date

6. **Save the script** as `compile_pdf.py` in the project directory

7. **Execute the script**:
```bash
python compile_pdf.py
```

8. **Verify the output**:
   - Check that the PDF was created successfully
   - Confirm the file size is reasonable (should be 0.5-2 MB typically)
   - Report the final location to the user

## Example Usage

```
Agent: I've completed all research phases. Now I'll compile everything into a PDF report.

[Agent lists files found in project directory]

Agent: Creating PDF compilation script...

[Agent creates compile_pdf.py with all placeholders filled]

Agent: Executing PDF compilation...

[Agent runs: python compile_pdf.py]

Output:
Starting PDF compilation...
Project directory: /path/to/project
Processing 1/9: 00_INTAKE_BRIEF.md
  [OK] Processed successfully
...
[SUCCESS] PDF generated successfully!
  Location: /path/to/project/Brand_Complete_Research_Report.pdf
  Size: 0.71 MB

Agent: ✓ Research compilation complete! PDF saved at: Brand_Complete_Research_Report.pdf
```

## Notes

- This skill requires Python with `weasyprint` and `markdown` libraries
- The script handles UTF-8 encoding properly for international characters
- All markdown formatting (tables, code blocks, lists) is preserved in the PDF
- The PDF includes professional styling with page numbers and a table of contents
- Files are processed in the order specified to maintain logical flow
