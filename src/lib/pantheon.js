// Client helpers for the Pantheon feature.
// Wraps the /api/personas and /api/skills-registry endpoints.

export async function fetchPersonas() {
  const res = await fetch('/api/personas');
  if (!res.ok) throw new Error(`personas: HTTP ${res.status}`);
  return res.json();
}

export async function fetchSkillsRegistry() {
  const res = await fetch('/api/skills-registry');
  if (!res.ok) throw new Error(`skills-registry: HTTP ${res.status}`);
  return res.json();
}

const LOCAL_KEY = 'mc3_personas';

export function loadLocalPersonas() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalPersona(persona) {
  const list = loadLocalPersonas();
  list.push(persona);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  return list;
}
