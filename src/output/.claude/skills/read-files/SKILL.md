---
name: read-files
description: Read and extract content from Google Docs, Google Sheets, images, PDFs, and uploaded files. Handles authentication, format conversion, and content extraction automatically.
---

# File Reader - Universal Content Extraction

## Overview

This skill reads content from various sources:
- **Google Docs** - Documents, reports, briefs
- **Google Sheets** - Spreadsheets, data tables, CSV-like content
- **Images** - Screenshots, photos, diagrams, infographics
- **PDFs** - Documents, reports, presentations
- **Uploaded Files** - Any file shared in the conversation

**Invoke this skill when:** User shares a link, uploads a file, or asks you to read/analyze any document or image.

---

## Google Docs

### How to Read Google Docs

**Method 1: Direct API (Try First)**
```
Tool: google_docs_read
Input: Google Doc URL (any format)
```

Accepts URLs like:
- `https://docs.google.com/document/d/DOCID/edit`
- `https://docs.google.com/document/d/DOCID/view`
- `https://docs.google.com/document/d/DOCID`
- Just the document ID

**Method 2: Web Scraper (Fallback)**
```
Tool: scrape_google_doc
Input: Google Doc URL
```

Use when:
- API returns permission error
- Doc is published/shared publicly
- URL ends in `/pub` or `/preview`

### Workflow for Google Docs

```
1. User shares Google Doc link
2. Try google_docs_read first
3. If fails → Try scrape_google_doc
4. If both fail → Ask user to:
   - Check sharing settings (Anyone with link can view)
   - Or copy/paste content directly
5. Never ask user which method - try automatically
```

### Common Google Doc Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Permission denied" | Doc is private | Try scraper or ask user to share |
| "Not found" | Invalid URL/ID | Verify URL format |
| "Rate limited" | Too many requests | Wait and retry |

---

## Google Sheets

### How to Read Google Sheets

**Method 1: Direct API (Try First)**
```
Tool: google_sheets_read
Input: Google Sheet URL
Optional: Sheet name, cell range
```

Accepts URLs like:
- `https://docs.google.com/spreadsheets/d/SHEETID/edit`
- `https://docs.google.com/spreadsheets/d/SHEETID/edit#gid=0`
- Just the spreadsheet ID

**Method 2: Web Scraper (Fallback)**
```
Tool: scrape_webpage
Input: Published Google Sheet URL
```

Use when sheet is published to web.

### Reading Specific Data

**Entire Sheet:**
```
google_sheets_read(url)
```

**Specific Sheet Tab:**
```
google_sheets_read(url, sheet_name="Sheet2")
```

**Specific Range:**
```
google_sheets_read(url, range="A1:D100")
```

**Named Range:**
```
google_sheets_read(url, range="MyNamedRange")
```

### Workflow for Google Sheets

```
1. User shares Google Sheet link
2. Try google_sheets_read first
3. If fails → Try scrape_webpage (if published)
4. If both fail → Ask user to:
   - Check sharing settings
   - Export as CSV and upload
5. Parse data into usable format
6. Summarize structure (rows, columns, headers)
```

---

## Images

### How to Read Images

**Method: Direct Read Tool**
```
Tool: Read
Input: Path to image file
```

Supported formats:
- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- WebP (.webp)

### Where Images Come From

**1. User Uploads to Slack/Chat**
- Automatically saved to `attachments/` folder
- Path provided in message: `[USER UPLOADED FILE: image.png] Saved to: attachments/image.png`
- Read immediately with: `Read attachments/image.png`

**2. URLs to Images**
- Download first using web scraper or fetch
- Then read the downloaded file

### Image Reading Workflow

```
1. See [USER UPLOADED FILE: X] in message
2. Note the file path (attachments/filename.ext)
3. Use Read tool on that path
4. Describe/analyze image content
5. Extract any text visible in image (OCR-like)
```

### What You Can Do With Images

- **Describe** - What's in the image
- **Extract Text** - Read text/screenshots
- **Analyze** - Charts, graphs, data visualizations
- **Compare** - Multiple images side by side
- **Identify** - Products, logos, UI elements

### Image Analysis Prompts

When reading images, consider:
- What is the main subject?
- Is there text? What does it say?
- What's the context/purpose?
- Are there data/numbers to extract?
- What details are relevant to user's question?

---

## PDFs

### How to Read PDFs

**Method 1: Full Text Extraction**
```
Tool: pdf_extract_text
Input: Path to PDF file
```

Extracts all text content from PDF.

**Method 2: Search Within PDF**
```
Tool: pdf_find
Input: Path to PDF file, search query
```

Finds specific content within large PDFs.

### PDF Reading Workflow

```
1. User uploads PDF → Saved to attachments/
2. For full content: pdf_extract_text
3. For specific info: pdf_find with query
4. Summarize key findings
5. Quote relevant sections
```

### Handling Large PDFs

For PDFs over 50 pages:
1. Use `pdf_find` to locate relevant sections
2. Extract only needed pages/sections
3. Summarize in chunks if needed

---

## Uploaded Files

### Supported File Types

| Type | Extension | How to Read |
|------|-----------|-------------|
| Images | .png, .jpg, .gif, .webp | `Read` tool directly |
| PDFs | .pdf | `pdf_extract_text` or `pdf_find` |
| Text | .txt, .md | `Read` tool directly |
| Code | .js, .ts, .py, .json | `Read` tool directly |
| CSV | .csv | `Read` tool directly |
| Audio | .mp3, .wav, .m4a | Transcribe with whisper via Bash |
| Video | .mp4, .webm | Extract audio → transcribe |

### File Location

All uploaded files are saved to:
```
attachments/[filename]
```

The message will include:
```
[USER UPLOADED FILE: filename.ext] Saved to: attachments/filename.ext
```

### Universal File Reading Workflow

```
1. Check message for [USER UPLOADED FILE: X]
2. Note the file path
3. Determine file type from extension
4. Use appropriate tool:
   - Images → Read
   - PDFs → pdf_extract_text
   - Text/Code → Read
   - Audio → Bash whisper
5. Process and respond to user's request
```

---

## Audio/Video Transcription

### Audio Files

```bash
# Transcribe audio file
whisper attachments/audio.mp3 --model base --output_format txt
```

### Video Files

```bash
# Extract audio from video
ffmpeg -i attachments/video.mp4 -vn -acodec mp3 attachments/audio.mp3

# Then transcribe
whisper attachments/audio.mp3 --model base --output_format txt
```

---

## Web Content

### Scraping Web Pages

```
Tool: scrape_webpage
Input: Any public URL
```

Use for:
- Blog posts
- Articles
- Public web pages
- Published Google Docs/Sheets

### When to Scrape vs API

| Source | First Try | Fallback |
|--------|-----------|----------|
| Google Doc (private) | google_docs_read | scrape_google_doc |
| Google Doc (public) | scrape_google_doc | google_docs_read |
| Google Sheet | google_sheets_read | scrape_webpage |
| Any website | scrape_webpage | - |

---

## Automatic Detection

### Trigger Phrases

Invoke this skill when user says:
- "Read this document"
- "What does this say?"
- "Look at this image"
- "Check this spreadsheet"
- "Analyze this PDF"
- "What's in this file?"
- "Can you see this?"
- "Here's a link to..."
- "I uploaded..."
- Any Google Docs/Sheets/Drive URL
- Any file upload notification

### URL Pattern Detection

| Pattern | Action |
|---------|--------|
| `docs.google.com/document` | Google Doc → google_docs_read |
| `docs.google.com/spreadsheets` | Google Sheet → google_sheets_read |
| `drive.google.com/file` | Google Drive file → download then read |
| `[USER UPLOADED FILE:]` | Local file → Read/pdf_extract_text |
| Any other URL | Web page → scrape_webpage |

---

## Error Handling

### Permission Errors

```
If "permission denied" or "access forbidden":
1. Try alternative method (scraper)
2. If still fails, tell user:
   "I can't access that document. Could you either:
   - Change sharing to 'Anyone with link can view'
   - Copy/paste the content here
   - Download and upload the file directly"
```

### File Not Found

```
If file path doesn't exist:
1. Check attachments/ folder
2. List available files with Glob
3. Ask user to re-upload if needed
```

### Large File Handling

```
If file is very large:
1. For PDFs: Use pdf_find for targeted search
2. For text: Read in chunks
3. For data: Summarize structure first
4. Always tell user if content was truncated
```

---

## Response Format

After reading any file/document, respond with:

```
## Document Summary

**Source:** [URL or filename]
**Type:** [Google Doc / Sheet / PDF / Image / etc.]
**Size:** [Pages / rows / dimensions if applicable]

### Key Content

[Main content extracted, organized logically]

### Relevant Details

[Specific information user asked about]

### Notes

[Any issues encountered, truncation, etc.]
```

---

## Examples

### Example 1: Google Doc

**User:** "Read this doc: https://docs.google.com/document/d/abc123/edit"

**Action:**
1. `google_docs_read("https://docs.google.com/document/d/abc123/edit")`
2. If fails → `scrape_google_doc("https://docs.google.com/document/d/abc123/edit")`
3. Summarize content

### Example 2: Uploaded Image

**User:** "What's in this image?"
**Message contains:** `[USER UPLOADED FILE: screenshot.png] Saved to: attachments/screenshot.png`

**Action:**
1. `Read("attachments/screenshot.png")`
2. Describe image content
3. Extract any visible text
4. Answer user's question

### Example 3: Google Sheet

**User:** "Pull the data from this sheet: [URL]"

**Action:**
1. `google_sheets_read(url)`
2. Parse tabular data
3. Summarize: "Found X rows, Y columns. Headers are: [...]"
4. Present data in readable format

### Example 4: PDF Analysis

**User uploads PDF:** "Find all mentions of pricing in this"
**Message contains:** `[USER UPLOADED FILE: proposal.pdf] Saved to: attachments/proposal.pdf`

**Action:**
1. `pdf_find("attachments/proposal.pdf", "pricing")`
2. Or `pdf_find("attachments/proposal.pdf", "price")`
3. Or `pdf_find("attachments/proposal.pdf", "$")`
4. Compile all pricing mentions
5. Present organized summary

---

## Critical Reminders

🚨 **ALWAYS read uploaded files immediately** - Don't wait to be asked twice
🚨 **ALWAYS try API first, then scraper** - For Google Docs/Sheets
🚨 **NEVER ask user which method** - Try automatically, fail gracefully
🚨 **ALWAYS confirm what you found** - Summarize content back to user
🚨 **ALWAYS check attachments/ folder** - For uploaded files
🚨 **NEVER say "I can't see images"** - You CAN read images with Read tool
🚨 **ALWAYS handle errors gracefully** - Offer alternatives if access fails






