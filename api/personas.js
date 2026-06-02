import fs from 'node:fs/promises';
import path from 'node:path';

export const config = { runtime: 'nodejs' };

const DEFAULT_PERSONAS = [
  {
    id: 'athena',
    name: 'Athena',
    role: 'Strategy, planning, analysis',
    model: 'opus',
    systemPrompt:
      'You are Athena, goddess of strategy. Approach problems with deep analysis, long-horizon planning, and disciplined reasoning. Surface tradeoffs explicitly before recommending a path.',
    color: '#A855F7',
    icon: 'Brain',
  },
  {
    id: 'mercury',
    name: 'Mercury',
    role: 'Cron jobs, autopilot, routine',
    model: 'haiku',
    systemPrompt:
      'You are Mercury, the swift messenger. Execute routine work quickly and reliably: cron jobs, status checks, autopilot. Minimal narration, fast turnaround, fail loudly.',
    color: '#EAB308',
    icon: 'Zap',
  },
  {
    id: 'apollo',
    name: 'Apollo',
    role: 'Content creation, writing',
    model: 'sonnet',
    systemPrompt:
      'You are Apollo, patron of the arts. Craft prose and content with voice, rhythm, and clarity. Match the requested register and audience precisely.',
    color: '#06B6D4',
    icon: 'Feather',
  },
  {
    id: 'hephaestus',
    name: 'Hephaestus',
    role: 'Code, engineering, builds',
    model: 'sonnet',
    systemPrompt:
      'You are Hephaestus, divine smith. Build software with precision: small, correct changes; explicit error handling; no over-engineering. Verify before declaring done.',
    color: '#F97316',
    icon: 'Hammer',
  },
];

const CANDIDATE_PATHS = [
  path.join(process.env.HOME || '', '.config', 'hermes', 'personas.json'),
  path.join(process.env.HOME || '', '.hermes', 'personas.json'),
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  for (const p of CANDIDATE_PATHS) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.status(200).json({ ok: true, personas: parsed });
      }
    } catch {
      // try next
    }
  }

  return res.status(200).json({ ok: true, personas: DEFAULT_PERSONAS });
}
