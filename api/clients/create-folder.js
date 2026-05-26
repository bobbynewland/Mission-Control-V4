// API route to create a Google Drive folder for a new client
// Uses gog CLI to create folders via Google Drive API

import { execSync } from 'child_process';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientName, clientId } = req.body;

  if (!clientName) {
    return res.status(400).json({ error: 'clientName is required' });
  }

  try {
    // Use gog CLI to create a folder in Drive
    // The folder name will be the client name
    const escapedName = clientName.replace(/"/g, '\\"');
    const command = `gog drive mkdir "${escapedName}" --no-input --json`;

    let output;
    try {
      output = execSync(command, { encoding: 'utf8', maxDuration: 30 });
    } catch (execErr) {
      // If gog fails, try a fallback approach
      console.error('gog mkdir failed:', execErr.message);
      return res.status(200).json({
        success: false,
        error: 'gog not available or failed',
        message: execErr.message,
        folderId: null,
        folderUrl: null
      });
    }

    let result;
    try {
      result = JSON.parse(output);
    } catch {
      // If not JSON, try to parse as text
      return res.status(200).json({
        success: true,
        folderName: clientName,
        message: output.trim(),
        folderId: null,
        folderUrl: null
      });
    }

    const folderId = result?.id || result?.fileId || result?.folderId || null;
    const folderUrl = folderId
      ? `https://drive.google.com/drive/folders/${folderId}`
      : null;

    return res.status(200).json({
      success: true,
      folderId,
      folderUrl,
      folderName: clientName,
      clientId
    });
  } catch (error) {
    console.error('Drive folder creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create Drive folder',
      message: error.message
    });
  }
}