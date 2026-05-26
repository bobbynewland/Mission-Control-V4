#!/usr/bin/env node
const { indexMemory } = require('../api/lib/memory-indexer.cjs');

(async () => {
  try {
    const result = await indexMemory();
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  }
})();
