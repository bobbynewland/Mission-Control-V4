# Lesson 1 Test Run — Pre-Flight Checklist

The lesson editor is ready at `~/Projects/mc3-worktrees/lesson-editor/scripts/lesson-edit.sh`. Before you can run a real lesson, you need to generate the actual video segments in Flow.

## What you need

1. **5 video segments from Flow** (or Veo/Omni), generated using the prompts in:
   `~/Documents/Obsidian Vault/Video Course/Lesson-01-Production-Plan.md`

2. **A lesson folder** structured like this:
   ```
   ~/Videos/lessons/lesson-01/
   ├── lesson.json          (copy from templates/lesson.json)
   ├── segments/
   │   ├── s1-hook.mp4
   │   ├── s2-big-idea.mp4
   │   ├── s3-what-it-does.mp4
   │   ├── s4-reassurance.mp4
   │   └── s5-win.mp4
   ├── voiceover.mp3        (already at ~/Documents/Obsidian Vault/Video Course/audio/lesson-01-voice-v2-trustworthy.mp3)
   └── music.mp3            (find a 75+ sec lo-fi or acoustic track)
   ```

## Step-by-step to run a real test

### 1. Set up the lesson folder

```bash
mkdir -p ~/Videos/lessons/lesson-01/segments
cp ~/Projects/mc3-worktrees/lesson-editor/templates/lesson.json ~/Videos/lessons/lesson-01/
cp ~/Documents/Obsidian\ Vault/Video\ Course/audio/lesson-01-voice-v2-trustworthy.mp3 ~/Videos/lessons/lesson-01/voiceover.mp3
```

### 2. Generate the 5 segments in Flow

Use the start frame + video prompts from the production plan. Save each segment as `sN-name.mp4` in the segments folder.

### 3. Add music

Find a 75+ second lo-fi or acoustic track on YouTube Audio Library, Uppbeat, or Artlist. Save as `music.mp3` in the lesson folder.

### 4. Run the editor

```bash
~/Projects/mc3-worktrees/lesson-editor/scripts/lesson-edit.sh ~/Videos/lessons/lesson-01
```

### 5. Check the output

```bash
open ~/Videos/lessons/lesson-01/output/lesson-final.mp4
```

## What can go wrong

| Issue | Fix |
|---|---|
| `ffmpeg: command not found` | `brew install ffmpeg` |
| `jq: command not found` | `brew install jq` |
| Audio out of sync | Regenerate voiceover or video to match length |
| Crossfade timing weird | Edit `crossfade` in lesson.json (try 0.1 or 0.5) |
| Color grade too warm/cold | Adjust `warmth` in lesson.json (-1 to 1) |
| Output is huge | Add `"crf": 23` to lesson.json (will need to update script to support) |

## Once it works

Same workflow for Lessons 2-7. Just:
1. Create `lesson-02` folder
2. Copy `lesson.json` template
3. Generate new segments
4. Run the editor

For 7 lessons, this turns a 14-hour production process into ~3-4 hours of actual work (most of which is generating the segments in Flow).
