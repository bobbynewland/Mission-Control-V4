export async function fetchBrief() {
  try {
    const res = await fetch('/api/dreaming-brief', { cache: 'no-store' });
    if (!res.ok) return { ok: false, brief: null };
    return await res.json();
  } catch (e) {
    return { ok: false, brief: null, error: e.message };
  }
}

export async function forceRefresh() {
  try {
    const res = await fetch('/api/dreaming-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    if (!res.ok) return { ok: false, brief: null };
    return await res.json();
  } catch (e) {
    return { ok: false, brief: null, error: e.message };
  }
}
