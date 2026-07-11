# OUT OF SPOONS — v0.19 Weekly Stakes Assets

Unpack this ZIP into the project root:

```text
C:\OutOfSpoons
```

It will create:

```text
assets/
  references/
    weekly-stakes/
      weekly-summary-mockup.png
      morning-weekly-stake-mockup.png
      critical-events-concept-sheet.png
  content/
    weekly-stakes/
      weekly-stakes-content-pack.md
  ASSET_MANIFEST_v0_19.md
```

## Files

### assets/references/weekly-stakes/weekly-summary-mockup.png
Reference mockup for the Weekly Summary / Stawka Tygodnia screen.

Use for:
- future polish of `weeklySummaryScreen.js`
- visual hierarchy of weekly challenge result + upcoming challenge
- milestone feeling / week-end ritual

Do not implement 1:1 yet unless explicitly requested.

### assets/references/weekly-stakes/morning-weekly-stake-mockup.png
Reference mockup for morning screen with an active weekly challenge teaser.

Use for:
- future v0.19.x or v0.20 UI polish
- compact condition marker
- visible but non-dominating weekly stake teaser

### assets/references/weekly-stakes/critical-events-concept-sheet.png
Concept sheet for later monthly Critical Events / Wielki Test.

Use later, likely v0.20+:
- family visit
- work deadline
- shared trip
- moving house
- public event / masking
- relationship crisis talk

Do not implement these as mechanics in v0.19.

### assets/content/weekly-stakes/weekly-stakes-content-pack.md
Content pack generated for Weekly Stakes:
- challenge ids
- titles
- categories
- descriptions
- visible conditions
- mechanical requirements
- success/failure text
- reward/penalty text

Use as source material for expanding `weeklyChallengeSystem.js`.

## Current implementation note

v0.19 currently implements a smaller safe pool of weekly challenges.
This content pack is intentionally larger than the implemented pool.
Do not blindly dump all challenges into code without balancing thresholds.

Recommended next step:
- select 12–16 strongest challenges
- normalize conditions to mixed requirements where possible
- avoid too many single-stat checks
- keep reward/penalty stable until balance testing
