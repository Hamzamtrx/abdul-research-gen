---
name: finalise-workflow
description: Once all the sub-agents have completed their tasks, this skill will finalize the workflow by archiving the project directory and generating a report in a PDF.
---

This skill is activated when all the agents have finished their tasks and the workflow has completed. It has not been completed yet until we compile all the information we have learnt into a comprehensive report in a PDF format.

We need to make sure that report is generated in a format that is easy to read and understand. We also need to ensure that the report is well-organized and includes all the necessary information. Additionally, we need to make sure that the report is generated in a timely manner so that it can be used to make informed decisions.

## IMPORTANT: Files to Include in PDF

When compiling the PDF report, include ONLY these research files:
- `01_Foundation/` - Foundation analysis
- `02_Audience/` - Audience intelligence  
- `03_Content/` - Content performance
- `04_Competitive/` - Competitive intelligence
- `05_Synthesis/` - Strategic synthesis
- `06_Scripts/FINAL_SCRIPTS.md` - All generated scripts

**NEVER include `00_INTAKE_BRIEF.md` in the PDF** - this file contains raw JSON intake data that should not appear in the final client-facing report.
