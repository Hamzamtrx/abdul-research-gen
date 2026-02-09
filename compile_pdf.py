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
project_dir = r"C:\Users\Flare\Desktop\claude\src\output\Projects\ThomsonCarter_2025-10-10_VanillaDay_AdResearch"
output_file = os.path.join(project_dir, "ThomsonCarter_Complete_Research_Report.pdf")

# Files in specific order
markdown_files = [
    "00_INTAKE_BRIEF.md",
    "01_Foundation/FOUNDATION_ANALYSIS.md",
    "02_Audience/AUDIENCE_INTELLIGENCE.md",
    "03_Content/CONTENT_PERFORMANCE.md",
    "04_Competitive/COMPETITIVE_INTELLIGENCE.md",
    "05_Synthesis/STRATEGIC_SYNTHESIS_MASTER.md",
    "06_Scripts/UGC_SCRIPTS.md",
    "06_Scripts/PODCAST_SCRIPTS.md"
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
        "00_INTAKE_BRIEF.md": "Brand Intake Brief",
        "01_Foundation/FOUNDATION_ANALYSIS.md": "Foundation Research & Market Analysis",
        "02_Audience/AUDIENCE_INTELLIGENCE.md": "Audience Intelligence & Insights",
        "03_Content/CONTENT_PERFORMANCE.md": "Content Performance Analysis",
        "04_Competitive/COMPETITIVE_INTELLIGENCE.md": "Competitive Intelligence",
        "05_Synthesis/STRATEGIC_SYNTHESIS_MASTER.md": "Strategic Synthesis & Recommendations",
        "06_Scripts/UGC_SCRIPTS.md": "UGC Ad Scripts",
        "06_Scripts/PODCAST_SCRIPTS.md": "Podcast Ad Scripts"
    }

    for i, file in enumerate(files, 1):
        title = file_titles.get(file, file.replace('.md', '').replace('-', ' ').title())
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
        <title>Thomson Carter - Are You Vanilla Day - Complete Research Report</title>
    </head>
    <body>
    """)

    # Add cover page
    html_parts.append("""
    <div style="text-align: center; margin-top: 200pt;">
        <h1 style="font-size: 36pt; border: none; page-break-before: auto;">THOMSON CARTER</h1>
        <h2 style="font-size: 24pt; color: #666;">Are You Vanilla Day</h2>
        <p style="font-size: 14pt; margin-top: 50pt;">Complete Campaign Research & Strategy Report</p>
        <p style="font-size: 12pt; color: #666; margin-top: 30pt;">10ml Eau de Parfum (£15)</p>
        <p style="font-size: 11pt; color: #999; margin-top: 20pt;">Campaign Goal: Reduce CPA from £21 to £18</p>
        <p style="font-size: 11pt; color: #999; margin-top: 10pt;">November 2025</p>
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
