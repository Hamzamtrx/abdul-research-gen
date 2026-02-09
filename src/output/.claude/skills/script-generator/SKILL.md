---
name: script-generator
description: Orchestrate 35 UGC and podcast scripts by calling /summarise, then /make-script-ugc and /make-script-podcast.
---

# Script Generator - Orchestrator

## Overview

This skill coordinates script creation. It does NOT write scripts directly. It delegates to:
- /make-script-ugc for UGC scripts
- /make-script-podcast for podcast scripts

The goal is to produce 35 total scripts (15 UGC + 20 Podcast) using the validated angles from research.

## Workflow

### STEP 0: Get Context (Mandatory)
Call /summarise to get the full research summary. Use this as the single source of truth.

### STEP 1: Build Script Input Packet
Create a single input packet that will be reused for every script call. Only include verified data from /summarise or the intake. If a field is missing, ask the user or mark it as UNKNOWN. Do not invent data.

Template:

PRODUCT INFORMATION
- PRODUCT NAME:
- BRAND:
- WEBSITE:
- PRICE:
- GUARANTEE:

MECHANISM AND SCIENCE
- ROOT CAUSE:
- KEY INGREDIENTS:
- HOW IT WORKS:
- UNIQUE MECHANISM (YES/NO):
- IF YES, WHAT IS IT:
- NUTRIENT COMPARISONS:
- WHY ALTERNATIVES FAIL:

TARGET CUSTOMER
- GENDER:
- AGE RANGE:
- PRIMARY SYMPTOMS:
- FAILED SOLUTIONS:
- EMOTIONAL STATE:

BRAND CONTEXT
- BRAND VOICE:
- FOUNDER STORY:
- KEY DIFFERENTIATOR:
- PROOF POINTS:
- COMMON OBJECTIONS (for podcast scripts):

CREATIVE DIRECTION
- MARKET SOPHISTICATION:
- AWARENESS LEVEL:

### STEP 2: Plan Angles and Variations
Use the 5 validated angles from /summarise.
- UGC: 3 scripts per angle (15 total)
- Podcast: 4 scripts per angle (20 total)

Vary the format and awareness level within each angle so each script is distinct and testable.

### STEP 3: Generate UGC Scripts
For each UGC script, call /make-script-ugc with:
- The Script Input Packet
- The specific angle and hypothesis
- UGC style selection (Transformation, Reverse Selling, Medical Story, 30-Day Results, Stitch to Viral)
- Creator type and persona

### STEP 4: Generate Podcast Scripts
For each podcast script, call /make-script-podcast with:
- The Script Input Packet
- The specific angle and hypothesis
- Podcast format selection (Friends, Solo Story, Expert Interview, Debate, Accidental Discovery)

### STEP 5: Compile Output
Create one file: 06_Scripts/FINAL_SCRIPTS.md
Organize scripts by format and angle. Paste the full output from each /make-script-ugc or /make-script-podcast call under its script header.

Suggested structure:

```markdown
# Final Scripts - [Brand Name]

Generated: [Date]
Total Scripts: 35 (15 UGC + 20 Podcast)

---

## UGC Scripts (15 Total)

### Angle 1: [Angle Name] (Scripts 1-3)

#### Script 1
[Paste full /make-script-ugc output]

---

#### Script 2
[Paste full /make-script-ugc output]

---

#### Script 3
[Paste full /make-script-ugc output]

---

[Repeat for all angles]

---

## Podcast Scripts (20 Total)

### Angle 1: [Angle Name] (Scripts 1-4)

#### Script 1
[Paste full /make-script-podcast output]

---

[Repeat for all angles]
```

## Hard Rules
- Always call /summarise first.
- Always use /make-script-ugc and /make-script-podcast for script creation.
- Do not generate scripts inside this skill.
- Do not add claims that are not verified.
- If a required field is missing, ask the user before proceeding.

## Success Criteria
- 35 total scripts delivered (15 UGC + 20 Podcast)
- 5 angles used consistently across both formats
- Each script is distinct, testable, and aligned to its angle
- Output saved in 06_Scripts/FINAL_SCRIPTS.md
