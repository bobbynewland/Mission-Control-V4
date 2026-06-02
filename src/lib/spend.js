export async function fetchSpend() {
  const response = await fetch('/api/spend');
  if (!response.ok) {
    throw new Error(`spend fetch failed: ${response.status}`);
  }
  return response.json();
}

export const fetchSpendData = fetchSpend;
