---
name: summarise
description: Generates comprehensive but concise contextual summary of all research phases, extracting key insights from foundation, audience, content, competitive, and synthesis reports to inform script generation
tools: Read
model: claude-sonnet-4-5
---

# Summarise Skill - Contextual Summary for Script Generation

## Purpose
This skill reads all research files from phases 01-05 and creates a comprehensive but concise summary that provides high-level context for the Script Generator. It covers everything without excessive detail, highlighting the most critical insights needed for script creation.

## What This Skill Does

1. **Reads all research files** from the current project directory
2. **Extracts key highlights** from each research phase
3. **Returns a structured summary** covering:
   - Business Overview & Positioning
   - Target Audience Insights
   - Content Strategy Insights
   - Competitive Landscape
   - Validated Angles & Script Distribution
   - Key Hooks, Pain Points, and CTAs

4. **Provides in-memory context** (not written to file) for immediate use by Script Generator

## How to Use

Simply invoke this skill at the start of script generation:

```
/summarise
```

The skill will automatically:
- Locate all research files in the current working directory
- Extract high-level highlights from each phase
- Return a comprehensive contextual summary
- Provide this summary in-memory for immediate use

## Instructions for AI Agent

When this skill is activated:

### Step 1: Locate Research Files

Find these files in the current project directory:

```
00_INTAKE/
├── 00_INTAKE_BRIEF.md

01_Foundation/
├── foundation_analysis.md
├── market_summary.md
├── script_angle_framework.md

02_Audience/
└── audience_intelligence.md

03_Content/
└── content_performance.md

04_Competitive/
└── competitive_intelligence.md

05_Synthesis/
└── strategic_synthesis.md (or FINAL_MARKET_RESEARCH_REPORT.md)
```

### Step 2: Extract Key Highlights from Each Phase

**From 00_INTAKE_BRIEF.md:**
- Brand name
- Product name and details
- Price point
- Unique value proposition
- Primary customer pain points (top 3-5)
- Target demographic

**From 01_Foundation (foundation_analysis.md):**
- Market positioning (how brand is positioned)
- Top 3 competitive differentiators
- Key competitors identified
- Market gaps/opportunities
- Validated positioning statement

**From 02_Audience (audience_intelligence.md):**
- Top 5-7 pain points (highest severity scores)
- Top 10 verbatim customer quotes (exact language from Reddit/forums)
- Primary objections to address
- Customer language patterns
- Emotional triggers identified

**From 03_Content (content_performance.md):**
- Top 10-15 winning hooks (highest engagement from TikTok/Meta)
- Best-performing content formats
- Optimal video length
- Winning tonality/voice
- TikTok trends to leverage
- Social proof patterns

**From 04_Competitive (competitive_intelligence.md):**
- Key competitors and their positioning
- Longest-running competitor ads (proven winners)
- Saturated angles to avoid
- Whitespace opportunities
- Competitor hook patterns
- What's working in the market

**From 05_Synthesis (strategic_synthesis.md or FINAL_MARKET_RESEARCH_REPORT.md):**
- Top 5-10 validated angles (with confidence scores)
- 3-5 core audience segments
- Hook bank (30+ hooks compiled)
- Pain language vault
- Objection responses
- CTA variations
- Script distribution strategy

### Step 3: Create Comprehensive Contextual Summary

Output the summary in this structured format:

```markdown
# CONTEXTUAL SUMMARY FOR SCRIPT GENERATION
## [Brand Name] - [Product Name]

---

## 1. BUSINESS OVERVIEW & POSITIONING

**Brand:** [Brand name]
**Product:** [Product name and details]
**Price:** [Price point]
**Category:** [Product category]

**Unique Value Proposition:**
[1-2 sentence positioning statement]

**Key Differentiators:**
1. [Differentiator 1]
2. [Differentiator 2]
3. [Differentiator 3]

**Market Positioning:**
[How brand is positioned vs competitors - 2-3 sentences]

---

## 2. TARGET AUDIENCE INSIGHTS

**Primary Audience Segments:**
1. **[Segment 1]** - [Brief description]
2. **[Segment 2]** - [Brief description]
3. **[Segment 3]** - [Brief description]

**Critical Pain Points (Severity: X/10):**
1. "[Verbatim customer quote]" - Severity: X/10
2. "[Verbatim customer quote]" - Severity: X/10
3. "[Verbatim customer quote]" - Severity: X/10
4. "[Verbatim customer quote]" - Severity: X/10
5. "[Verbatim customer quote]" - Severity: X/10

**Customer Language Patterns:**
- [Key phrase/language pattern 1]
- [Key phrase/language pattern 2]
- [Key phrase/language pattern 3]

**Primary Objections:**
1. [Objection 1] → Response: [How to address]
2. [Objection 2] → Response: [How to address]
3. [Objection 3] → Response: [How to address]

**Emotional Triggers:**
- [Trigger 1]
- [Trigger 2]
- [Trigger 3]

---

## 3. CONTENT STRATEGY INSIGHTS

**Top Winning Hooks (from TikTok/Meta Research):**
1. "[Hook 1]" - Source: [Platform] | Engagement: [Metric]
2. "[Hook 2]" - Source: [Platform] | Engagement: [Metric]
3. "[Hook 3]" - Source: [Platform] | Engagement: [Metric]
4. "[Hook 4]" - Source: [Platform] | Engagement: [Metric]
5. "[Hook 5]" - Source: [Platform] | Engagement: [Metric]
6. "[Hook 6]" - Source: [Platform] | Engagement: [Metric]
7. "[Hook 7]" - Source: [Platform] | Engagement: [Metric]
8. "[Hook 8]" - Source: [Platform] | Engagement: [Metric]
9. "[Hook 9]" - Source: [Platform] | Engagement: [Metric]
10. "[Hook 10]" - Source: [Platform] | Engagement: [Metric]

**Best-Performing Formats:**
- Format: [Format type] | Performance: [Metric]
- Optimal Length: [X-Y seconds]
- Tonality: [Voice/tone that works]

**TikTok Trends to Leverage:**
- [Trend 1]
- [Trend 2]
- [Trend 3]

**Social Proof Patterns:**
- [Pattern 1 - e.g., "before/after transformations"]
- [Pattern 2 - e.g., "stranger compliments"]
- [Pattern 3 - e.g., "expert endorsements"]

---

## 4. COMPETITIVE LANDSCAPE

**Key Competitors:**
1. **[Competitor 1]** - Positioning: [How they position]
2. **[Competitor 2]** - Positioning: [How they position]
3. **[Competitor 3]** - Positioning: [How they position]

**Proven Competitor Strategies (Long-Running Ads):**
- [Competitor]: "[Hook/angle they use]" - Running for: [Duration]
- [Competitor]: "[Hook/angle they use]" - Running for: [Duration]

**Saturated Angles (Avoid):**
❌ [Angle 1 - overused in market]
❌ [Angle 2 - overused in market]
❌ [Angle 3 - overused in market]

**Whitespace Opportunities (Pursue):**
✅ [Opportunity 1 - underutilized angle]
✅ [Opportunity 2 - underutilized angle]
✅ [Opportunity 3 - underutilized angle]

**Competitive Differentiation:**
[1-2 sentences on what this brand does that NO competitor does]

---

## 5. VALIDATED ANGLES & SCRIPT DISTRIBUTION

**Top Validated Angles (Confidence Scores):**

1. **[Angle 1 Name]** - Confidence: X/10
   - Target Audience: [Segment]
   - Key Message: [Core message]
   - Why It Works: [Brief reasoning]

2. **[Angle 2 Name]** - Confidence: X/10
   - Target Audience: [Segment]
   - Key Message: [Core message]
   - Why It Works: [Brief reasoning]

3. **[Angle 3 Name]** - Confidence: X/10
   - Target Audience: [Segment]
   - Key Message: [Core message]
   - Why It Works: [Brief reasoning]

4. **[Angle 4 Name]** - Confidence: X/10
   - Target Audience: [Segment]
   - Key Message: [Core message]
   - Why It Works: [Brief reasoning]

5. **[Angle 5 Name]** - Confidence: X/10
   - Target Audience: [Segment]
   - Key Message: [Core message]
   - Why It Works: [Brief reasoning]

**Script Distribution Strategy:**
- **UGC Scripts (15 total):**
  - Angle 1: [X] scripts
  - Angle 2: [X] scripts
  - Angle 3: [X] scripts
  - Angle 4: [X] scripts
  - Angle 5: [X] scripts

- **Podcast Scripts (20 total):**
  - Angle 1: [X] scripts
  - Angle 2: [X] scripts
  - Angle 3: [X] scripts
  - Angle 4: [X] scripts
  - Angle 5: [X] scripts

---

## 6. SCRIPT INGREDIENTS LIBRARY

**Hook Bank (Top 30 from Synthesis):**

*Use these hooks across scripts, adapting to specific angles*

1. "[Hook 1]"
2. "[Hook 2]"
3. "[Hook 3]"
4. "[Hook 4]"
5. "[Hook 5]"
6. "[Hook 6]"
7. "[Hook 7]"
8. "[Hook 8]"
9. "[Hook 9]"
10. "[Hook 10]"
[... continue through 30]

**Pain Language Vault (Verbatim Quotes):**

*Use exact customer language in scripts*

- "[Quote 1]"
- "[Quote 2]"
- "[Quote 3]"
- "[Quote 4]"
- "[Quote 5]"
[... continue through top 10-15]

**Benefit Statements:**
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]
- [Benefit 4]
- [Benefit 5]

**CTA Variations:**
- [CTA 1]
- [CTA 2]
- [CTA 3]
- [CTA 4]
- [CTA 5]

**Compliance Guardrails:**
- ✅ Approved Language: [List approved claims/language]
- ❌ Forbidden Claims: [List forbidden claims]

---

## 7. KEY TAKEAWAYS FOR SCRIPT GENERATION

**Priority 1: Hooks Must Be 10/10**
- Use hooks from the hook bank above
- Adapt proven TikTok/Meta patterns
- Ensure hooks match angle and audience

**Priority 2: Use Verbatim Customer Language**
- Pull from pain language vault
- Match emotional intensity
- Use exact phrases from Reddit research

**Priority 3: Distribute Across Validated Angles**
- Follow distribution strategy above
- Highest-confidence angles get more scripts
- Ensure each angle is represented

**Priority 4: Competitive Differentiation**
- Emphasize whitespace opportunities
- Reference competitors by name where relevant
- Avoid saturated angles

**Priority 5: Social Proof Patterns**
- Leverage patterns from content research
- Use specific examples
- Create believable scenarios

---

**Summary Complete - Ready for Script Generation**
```

### Step 4: Return Summary

**IMPORTANT:** This summary is provided IN-MEMORY only. Do NOT write it to a file. Return the summary directly for the Script Generator to use immediately.

The Script Generator should use this summary as high-level context while generating scripts, referring back to the detailed research files when needed for specific examples or data.

## Example Usage

```
Script Generator Agent: Before generating scripts, let me get a comprehensive contextual summary.

[Calls /summarise skill]

[Summarise skill reads all research files and returns structured summary]

Script Generator Agent: Perfect! I now have comprehensive context covering:
- Business positioning and differentiators
- Top pain points with verbatim customer quotes
- Winning hooks from TikTok/Meta research
- Competitive landscape and whitespace opportunities
- 5 validated angles with distribution strategy
- Hook bank and script ingredients

Now I'll generate scripts using this context...

[Proceeds with script generation using summary as reference]
```

## Benefits

1. **Comprehensive Coverage:** All research phases summarized in one place
2. **Concise Format:** High-level highlights without overwhelming detail
3. **In-Memory Efficiency:** No extra files created, immediate use
4. **Better Scripts:** Script Generator has full context before writing
5. **Consistency:** Scripts align with research insights across all phases
6. **Time Savings:** Quick reference instead of reading multiple long files

---

**Note:** This skill is designed to be called at the START of script generation, providing the Script Generator with a complete contextual overview before writing any scripts.
