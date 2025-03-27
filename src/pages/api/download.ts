import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || ''
  );
  
  try {
    // Get file details
    const { data, error } = await supabase
      .from('content')
      .select('file_url, title, downloads')
      .eq('id', id)
      .single();
      
    if (error || !data) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Increment download count
    await supabase
      .from('content')
      .update({ downloads: (data.downloads || 0) + 1 })
      .eq('id', id);
      
    // Fetch the file content
    const fileResponse = await fetch(data.file_url);
    const fileBuffer = await fileResponse.buffer();
    
    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/[^a-z0-9]/gi, '_')}.html"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileBuffer.length);
    
    // Send the file content
    res.send(fileBuffer);
  } catch (err) {
    console.error('Error in download API:', err);
    res.status(500).json({ error: 'Server error' });
  }
} 