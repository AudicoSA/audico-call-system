-- =====================================================
-- Audico Call System - Supabase Database Setup
-- Run this entire script in your Supabase SQL Editor
-- =====================================================

-- Step 1: Create products table
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'ZAR',
  discount DECIMAL(5, 2) DEFAULT 0,
  on_sale BOOLEAN DEFAULT false,
  stock_level INTEGER DEFAULT 0,
  estimated_restock DATE,
  features TEXT[],
  specifications JSONB,
  images TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 2: Enable pgvector extension (for semantic search)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 3: Create product_embeddings table
-- =====================================================
CREATE TABLE IF NOT EXISTS product_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content TEXT, -- The text that was embedded
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
DROP INDEX IF EXISTS product_embeddings_embedding_idx;
CREATE INDEX product_embeddings_embedding_idx ON product_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Create vector search function
-- =====================================================
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  sku VARCHAR,
  name VARCHAR,
  description TEXT,
  category VARCHAR,
  price DECIMAL,
  currency VARCHAR,
  stock_level INTEGER,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.sku,
    p.name,
    p.description,
    p.category,
    p.price,
    p.currency,
    p.stock_level,
    1 - (pe.embedding <=> query_embedding) AS similarity
  FROM product_embeddings pe
  JOIN products p ON pe.product_id = p.id
  WHERE 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 5: Set up Row Level Security (RLS)
-- =====================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access on products" ON products;
DROP POLICY IF EXISTS "Allow public read access on product_embeddings" ON product_embeddings;
DROP POLICY IF EXISTS "Allow service role full access on products" ON products;
DROP POLICY IF EXISTS "Allow service role full access on product_embeddings" ON product_embeddings;

-- Allow public read access
CREATE POLICY "Allow public read access on products"
  ON products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access on product_embeddings"
  ON product_embeddings FOR SELECT
  TO public
  USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access on products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on product_embeddings"
  ON product_embeddings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 6: Insert sample products
-- =====================================================
INSERT INTO products (sku, name, description, category, price, currency, stock_level, features) VALUES
  (
    'TV-SONY-55-4K',
    'Sony 55" 4K Smart TV',
    'Experience stunning picture quality with this 55-inch 4K Ultra HD Smart TV from Sony. Features HDR support, built-in Android TV, and voice control.',
    'Electronics',
    12999.99,
    'ZAR',
    15,
    ARRAY['4K Ultra HD', 'HDR Support', 'Android TV', 'Voice Control', 'Wi-Fi']
  ),
  (
    'TV-SAMSUNG-65-QLED',
    'Samsung 65" QLED TV',
    'Premium 65-inch QLED TV with Quantum Dot technology. Featuring stunning colors, deep blacks, and smart capabilities with Bixby voice assistant.',
    'Electronics',
    18999.99,
    'ZAR',
    8,
    ARRAY['QLED', 'Quantum Dot', 'Bixby', '4K', 'HDR10+']
  ),
  (
    'PHONE-IPHONE-15',
    'Apple iPhone 15 Pro',
    'Latest iPhone with A17 Pro chip, titanium design, and advanced camera system. Available in multiple storage options.',
    'Mobile Phones',
    19999.99,
    'ZAR',
    25,
    ARRAY['A17 Pro', 'Titanium', '48MP Camera', '5G', 'Face ID']
  ),
  (
    'LAPTOP-DELL-XPS13',
    'Dell XPS 13 Laptop',
    '13.4-inch ultraportable laptop with Intel Core i7, 16GB RAM, and 512GB SSD. Perfect for professionals on the go.',
    'Computers',
    21999.99,
    'ZAR',
    12,
    ARRAY['Intel Core i7', '16GB RAM', '512GB SSD', '13.4" Display', 'Backlit Keyboard']
  ),
  (
    'HEADPHONES-SONY-WH1000XM5',
    'Sony WH-1000XM5 Headphones',
    'Industry-leading noise cancelling headphones with exceptional sound quality and 30-hour battery life.',
    'Audio',
    5999.99,
    'ZAR',
    30,
    ARRAY['Noise Cancelling', '30hr Battery', 'Hi-Res Audio', 'Multipoint Connection']
  )
ON CONFLICT (sku) DO NOTHING;

-- =====================================================
-- Setup Complete!
-- =====================================================

-- Verify the setup
SELECT 'Products table created' AS status, COUNT(*) AS product_count FROM products;
SELECT 'Product embeddings table created' AS status FROM product_embeddings LIMIT 1;

-- Display sample products
SELECT sku, name, price, stock_level, category FROM products ORDER BY created_at DESC;
