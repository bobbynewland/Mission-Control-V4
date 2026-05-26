#!/usr/bin/env node
const { indexMemory, searchMemory } = require('../api/lib/memory-indexer.cjs');

const queries = process.argv.slice(2);
const defaultQueries = ['minimax', 'deploy', 'template'];

(async () => {
  const qs = queries.length ? queries : defaultQueries;
  const sync = await indexMemory();
  console.log('SYNC', JSON.stringify(sync));

  for (const q of qs) {
    const out = await searchMemory({ q, topK: 3 });
    console.log(`\nQUERY: ${q}`);
    out.results.forEach((r, i) => {
      console.log(`${i + 1}. score=${r.score.toFixed(4)} citation=${r.citation}`);
      console.log(`   snippet=${r.snippet.replace(/\n/g, ' ')}`);
    });
  }
})();
