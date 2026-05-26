const { spawn } = require('child_process');

module.exports = async (req, res) => {
  return new Promise((resolve) => {
    const proc = spawn('python3', ['/root/.openclaw/workspace/minimax-tracker.py', '--json']);
    let output = '';
    
    proc.stdout.on('data', (data) => { output += data; });
    proc.on('close', (code) => {
      try {
        const stats = JSON.parse(output || '{}');
        res.status(200).json(stats);
      } catch (e) {
        res.status(200).json({
          requests: 0,
          prompts: 0,
          tokensIn: 0,
          tokensOut: 0,
          limit: 300,
          windowHours: 5,
          remaining: 300
        });
      }
      resolve();
    });
  });
};
