import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'image/png');

  const imagePath = path.join(process.cwd(), 'public', 'image.png');
  let readStream: fs.ReadStream;
  try {
    readStream = fs.createReadStream(imagePath);
  } catch (err) {
    console.error('Error creating file stream:', err);
    res.status(500).end('Error streaming image');
    return;
  }

  readStream.on('data', (chunk) => {
    res.write(chunk);
    readStream.pause();
    setTimeout(() => readStream.resume(), 2000);
  });

  readStream.on('end', () => {
    res.end();
  });

  readStream.on('error', (err) => {
    console.error('Error reading file:', err);
    if (!res.headersSent) {
      res.status(500).end('Error streaming image');
    } else {
      res.end();
    }
  });
}
