# AI4U Routing OS — How To Use Storyboard

**Project:** AI4U Right-Tool Routing OS  
**Audience:** Everyday AI users, small-business owners, creators, and experienced operators  
**Owner:** Lee Hanna · AI4U, LLC  
**Live product:** https://routing.ai4utech.com  
**Source:** https://github.com/leephanna/ai4u-routing-os

## Experience objective

A first-time visitor should understand within ten seconds that they can describe an ordinary task, receive a recommended starting tool and prepared instructions, then check and record the real result. The experience must not require knowledge of AI platforms, prompt engineering, or software development.

The How To Use page uses everyday examples first and introduces advanced controls only after the visitor understands the basic workflow.

## Storyboard and screen sequence

| Screen | Visitor sees | Visual callouts | Interaction / expected result |
|---|---|---|---|
| 1. Hero | “Get More Out of AI. Start With the Right Tool.” | Three simple concepts: Your Goal → Right Tool → Proven Result | Show Me How starts the guided tour; Try a Real-Life Example loads a sample; Start With My Own Task opens Route Engine |
| 2. Everyday examples | Twelve common tasks: email, resume, business content, product comparison, research, fact checking, website/app, repair, images/video, automation, learning, project organization | Task icon, plain-language example, “Try this example” action | Selecting a card fills the Route Engine and displays a sample recommendation |
| 3. Describe the goal | Route Engine goal field with a sample email request | Callout ①: “Start with the outcome—not the tool.” | Guided tour fills a sample request without saving anything |
| 4. Add context | Current Asset, Constraint, Required Output, Task Stage, Risk Level | Callout ②: “A little context makes the route more useful.” | User can edit any field before routing |
| 5. Review the route | Recommended platform, routing basis, reason, avoidance guidance, where to use it, fallback, checklist | Callout ③: “Read the reason—not just the platform name.” | Route Engine displays a task-specific recommendation for common writing/research/creative/learning/planning requests; technical stages retain stage-based routes |
| 6. Prepare instructions | Prompt Gen with platform, task, audience, constraints, output, generated prompt | Callout ④: “Copy the instructions; you do not need to write them from scratch.” | Build Prompt carries route context into Prompt Gen and generates a reviewable prompt |
| 7. Use the AI and verify | Task-appropriate review checklist | Callout ⑤: “A polished answer is not automatically a correct answer.” | Visitor opens the recommended AI separately, pastes the prompt, supplies any needed files there, and checks the real deliverable |
| 8. Save the outcome | Ledger task, platform, outcome, lesson, artifact link, proof notes | Callout ⑥: “Save a real outcome—not a guess.” | Guided tour pre-fills sample task/platform but never selects an outcome or saves a fake success |

## Guided tour behavior

The persistent **SHOW ME HOW** launcher opens a seven-step walkthrough.

1. Welcome and purpose.
2. Fill a sample task in Route Engine.
3. Explain Task Stage and Risk Level.
4. Run the route and highlight the result.
5. Carry the route into Prompt Gen and generate the prompt.
6. Explain task-appropriate proof and highlight Proof Chain.
7. Pre-fill Ledger task/platform fields and explain how to record a real outcome.

### Interaction rules

- Tour progress is stored in browser localStorage so a visitor can resume on the same browser.
- The tour may pre-fill sample fields and generate a sample route/prompt.
- It must not send prompts to an external AI automatically.
- It must not save a fake Ledger entry, mark an outcome as successful, or create a proof receipt.
- Closing the tour removes the active highlight but leaves the current page and sample fields available.
- Completing the tour returns the visitor to How To Use.

## Visual direction

- Keep the existing near-black / slate AI4U environment and starfield.
- Use violet and gold to distinguish guidance and important callouts; retain cyan for existing application controls.
- Keep body copy readable and concise. Avoid platform jargon until the visitor reaches Power Tools.
- Use real application labels in the screen previews so the visual guide matches the actual controls.
- All cards and controls must work on desktop, tablet, and mobile.
- Keyboard users must be able to activate example cards and controls.

**Important:** The on-page storyboard panels are illustrative screen previews built from the current product's actual field names and actions. They are not captured browser screenshots. If photographic screenshots are added later, capture the live production interface and annotate the exact controls; do not substitute invented screenshots that differ from the product.

## Plain-language product boundaries

- AI4U recommends a starting platform and prepares instructions; the selected AI or software platform performs the task.
- The route percentage is a rule-based guidance indicator, not a measured success probability, benchmark, or accuracy guarantee.
- The current Route Engine accepts typed task context; it does not itself ingest file attachments. Users attach source files directly to the selected AI tool when that tool supports uploads.
- Without a connected and signed-in Supabase account, Ledger data is browser-local. Cross-device persistence requires the supported Supabase connection and sign-in.
- High-stakes medical, legal, financial, safety, and similar decisions require independent professional review.

## Technical preservation requirements

The redesign must not remove or break:

- Mission / dashboard
- Route Engine and its result actions
- Platform Matrix
- Prompt Generator
- Proof Chain and proof receipts
- Ledger and outcome logging
- Roadmap
- Settings
- Optional Supabase configuration, authentication, persistence, and local fallback
- Existing static Vercel deployment and GitHub source of truth

## Acceptance checklist

- [ ] Visitor can understand the purpose from the hero without reading technical documentation.
- [ ] All twelve example cards load the corresponding task details.
- [ ] Task-specific routes recognize common writing, marketing, research/comparison, visual, learning, and planning requests.
- [ ] Technical stages continue to use the existing route profiles.
- [ ] Build Prompt pre-fills Prompt Gen from the last route and generates a prompt.
- [ ] Seven visual storyboard slides navigate correctly.
- [ ] Guided tour advances, goes back, resumes, highlights the right target, and closes cleanly.
- [ ] Guided tour does not save an outcome or proof receipt.
- [ ] FAQ and glossary disclosures work.
- [ ] Desktop and mobile layouts remain usable.
- [ ] Existing app panels and Supabase scripts remain present.
- [ ] Footer includes: “AI4U, LLC · Lee Hanna © 2026 AI4U, LLC. All rights reserved.”

---

AI4U, LLC · Lee Hanna © 2026 AI4U, LLC. All rights reserved.
