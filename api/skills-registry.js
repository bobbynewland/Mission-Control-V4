import fs from 'node:fs/promises';
import path from 'node:path';

export const config = { runtime: 'nodejs' };

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return {};
  const parts = content.split(/\r?\n---\r?\n/);
  if (parts.length < 2) return {};
  const yaml = parts[0].replace(/^---\r?\n/, '');
  const out = {};
  const nameMatch = yaml.match(/^name\s*:\s*(.+)$/m);
  const descMatch = yaml.match(/^description\s*:\s*(.+)$/m);
  const catMatch = yaml.match(/^category\s*:\s*(.+)$/m);
  if (nameMatch) out.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
  if (descMatch) out.description = descMatch[1].trim().replace(/^["']|["']$/g, '');
  if (catMatch) out.category = catMatch[1].trim().replace(/^["']|["']$/g, '');
  return out;
}

async function countFiles(dir) {
  try {
    const entries = await fs.readdir(dir);
    return entries.length;
  } catch {
    return 0;
  }
}

async function readSkill(skillPath, categoryName) {
  const skillMd = path.join(skillPath, 'SKILL.md');
  let content;
  try {
    content = await fs.readFile(skillMd, 'utf8');
  } catch {
    return null;
  }
  const fm = parseFrontmatter(content);
  if (!fm.name) return null;

  const [scripts, references, assets] = await Promise.all([
    countFiles(path.join(skillPath, 'scripts')),
    countFiles(path.join(skillPath, 'references')),
    countFiles(path.join(skillPath, 'assets')),
  ]);

  return {
    name: fm.name,
    description: fm.description || '',
    category: fm.category || categoryName,
    path: skillPath,
    fileCount: scripts + references + assets,
    hasScripts: scripts > 0,
    hasReferences: references > 0,
    hasAssets: assets > 0,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const skillsRoot = path.join(process.env.HOME || '', '.hermes', 'skills');
  const categories = {};
  let totalCount = 0;

  try {
    const rootEntries = await fs.readdir(skillsRoot, { withFileTypes: true });

    for (const entry of rootEntries) {
      if (!entry.isDirectory()) continue;
      const categoryName = entry.name;
      const categoryPath = path.join(skillsRoot, categoryName);

      const skillsInCategory = [];

      // Case A: the category dir itself is a skill (has SKILL.md at top level)
      const rootSkill = await readSkill(categoryPath, categoryName);
      if (rootSkill) {
        skillsInCategory.push(rootSkill);
      }

      // Case B: subdirectories are skills
      let subEntries;
      try {
        subEntries = await fs.readdir(categoryPath, { withFileTypes: true });
      } catch {
        subEntries = [];
      }

      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue;
        const subPath = path.join(categoryPath, sub.name);
        const skill = await readSkill(subPath, categoryName);
        if (skill) skillsInCategory.push(skill);
      }

      if (skillsInCategory.length > 0) {
        categories[categoryName] = skillsInCategory;
        totalCount += skillsInCategory.length;
      }
    }

    return res.status(200).json({
      ok: true,
      categories,
      totalCount,
      totalCategories: Object.keys(categories).length,
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return res.status(200).json({
        ok: true,
        categories: {},
        totalCount: 0,
        totalCategories: 0,
      });
    }
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
