/*
  # Create content table and authentication

  1. New Tables
    - `content`
      - `id` (uuid, primary key)
      - `title` (text)
      - `type` (text)
      - `description` (text)
      - `version` (text)
      - `file_size` (text)
      - `image` (text)
      - `downloads` (integer)
      - `rating` (numeric)
      - `author` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `content` table
    - Add policies for authenticated users to manage content
    - Add policy for public users to read content
*/

-- Create the content table if it doesn't exist
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL,
  description text,
  version text,
  file_size text,
  image text,
  downloads integer DEFAULT 0,
  rating numeric DEFAULT 0,
  author text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
  ON content
  FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to insert content
CREATE POLICY "Allow authenticated create"
  ON content
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update their own content
CREATE POLICY "Allow authenticated update own content"
  ON content
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email = 'admin@admin.com'
  ));

-- Insert sample content
INSERT INTO content (title, type, description, version, file_size, image, downloads, rating, author)
VALUES 
  (
    'Modern UI Resource Pack',
    'Resource Pack',
    'A sleek, modern UI overhaul for Minecraft',
    '1.0.0',
    '24MB',
    'https://images.unsplash.com/photo-1536250853075-e8504ee040b9?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    1200,
    4.5,
    'admin'
  ),
  (
    'Enhanced Graphics Mod',
    'Mod',
    'Enhance your Minecraft graphics with realistic shaders',
    '2.1.0',
    '156MB',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    2500,
    4.8,
    'admin'
  ),
  (
    'Speed Runner Client',
    'Client',
    'Optimized client for Minecraft speedrunning',
    '1.5.2',
    '85MB',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    3100,
    4.2,
    'admin'
  );