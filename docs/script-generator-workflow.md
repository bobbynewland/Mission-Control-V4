# Mission Control V3 — Script Generator Workflow

## Purpose
Daily short-film idea workflow for Bobby:
1. Generate 3 ideas.
2. Save each idea into Notes + Knowledge Base.
3. Show the ideas clearly inside Workflows.
4. Let Bobby choose one to develop.
5. Expand the chosen one into full script + shot-by-shot prompts.
6. Keep the other two as references.

## Data model
Approval Queue item:

```json
{
  "workflowType": "script_ideas",
  "title": "Daily Short Film Ideas",
  "stage": "ideas_ready | selected_for_development | developing_script | script_ready",
  "status": "needs_approval | running",
  "selectedIdeaId": "idea-2",
  "ideas": [
    {
      "id": "idea-1",
      "rank": 1,
      "title": "...",
      "hook": "...",
      "concept": "...",
      "mood": "...",
      "status": "idea | reference | developing | selected",
      "noteId": "...",
      "knowledgeId": "...",
      "prompt": "...",
      "script": "...",
      "shotList": [],
      "storyPack": {
        "selectedConceptBreakdown": {},
        "characterAnchor": {},
        "wardrobeAnchors": [],
        "sceneAnchors": [],
        "storyStructure": [],
        "shotByShotPromptBlocks": [],
        "reusableAnchorSummary": {},
        "sequelEpisodeExpansionIdeas": [],
        "specCommercialSpinOffIdea": ""
      }
    }
  ],
  "scriptOutput": {
    "selectedConceptBreakdown": {},
    "characterAnchor": {},
    "wardrobeAnchors": [],
    "sceneAnchors": [],
    "storyStructure": [],
    "shotByShotPromptBlocks": [],
    "reusableAnchorSummary": {},
    "sequelEpisodeExpansionIdeas": [],
    "specCommercialSpinOffIdea": "",
    "fullScript": ""
  }
}
```

## What the UI does now
- Detects `workflowType: script_ideas` in `approvalQueue`.
- Renders a dedicated Short-Film Script Generator section.
- Shows all 3 ideas as an idea bank.
- Lets Bobby tap **Develop this one** on any idea.
- Marks the chosen one as selected/developing.
- Keeps the other ideas as reference.
- Syncs every idea into:
  - `workspaces/winslow_main/notes`
  - `workspaces/winslow_main/knowledge`
- Queues an agent task at:
  - `workspaces/winslow_main/agent_tasks`
  - task type: `script-workflow.develop-idea`

## Backend path now
This workflow is no longer fake UI glue.
It uses the same existing Firebase task lane as the council workflow runner.

### Worker
File:
- `/root/.openclaw/workspace/scripts/council_task_runner.py`

The runner now consumes:
- `script-workflow.develop-idea`

And it will:
1. Read the queued task from `workspaces/winslow_main/agent_tasks`
2. Load the workflow from `workspaces/winslow_main/approvalQueue/{workflowId}`
3. Find the selected idea by `ideaId`
4. Read the source-of-truth system prompt from:
   - `/root/.openclaw/workspace/prompts/short-film-ideas-system-prompt.md`
5. Call the shared AI router (`ai_studio_router.py`)
6. Expand the selected idea into:
   - Selected Concept Breakdown
   - Character Anchor
   - Wardrobe Anchors
   - Scene Anchors
   - 60-Second Story Structure
   - Shot-by-Shot Prompt Blocks
   - Reusable Anchor Summary
   - Sequel / Episode Expansion Ideas
   - Spec Commercial Spin-Off Idea
7. Write the finished output back onto the workflow and selected idea
8. Sync notes + knowledge for all 3 ideas
9. Preserve the unused 2 ideas as `reference`
10. Flip workflow state to `script_ready`

## Daily generation path
File:
- `/root/.openclaw/workspace/scripts/generate_script_ideas_workflow.py`

This creates or refreshes the daily `script_ideas` workflow item directly in Firebase.
It also syncs the 3 ideas into Notes + Knowledge Base immediately.

### Example manual run
```bash
python3 /root/.openclaw/workspace/scripts/generate_script_ideas_workflow.py --date $(date -u +%F)
```

### Example worker run
```bash
python3 /root/.openclaw/workspace/scripts/council_task_runner.py --once
```

### Continuous worker
```bash
python3 /root/.openclaw/workspace/scripts/council_task_runner.py --poll-seconds 5
```

## Production reality
### Automatic only if these are running
1. A daily trigger calls `generate_script_ideas_workflow.py`
2. A persistent worker calls `council_task_runner.py`

### What already works in code
- Daily workflow generation script exists
- UI selection + queueing exists
- Task consumer exists
- Firebase writeback exists
- Notes/knowledge sync exists

### What still depends on operations
- A real cron/systemd/tmux process must actually invoke the daily generator
- A real persistent worker process must actually keep the task runner alive

If those two host-side processes are running, the workflow is end-to-end usable.
If they are not running, the UI will queue tasks correctly but nothing will consume them.
