-- Create a new storage bucket for content files
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-files', 'content-files', true);

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-files');

-- Allow public to download files
CREATE POLICY "Allow public download files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'content-files');

-- Add file_url column to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS file_url text;