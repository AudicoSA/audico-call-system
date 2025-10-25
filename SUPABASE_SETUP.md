# Supabase Setup Guide - Product Knowledge & RAG

This guide explains how to set up Supabase for product knowledge retrieval using Retrieval-Augmented Generation (RAG).

## Overview

Your AI agent will use Supabase to:
- Store and retrieve product information
- Perform semantic search using vector embeddings
- Provide accurate, up-to-date product details to customers
- Check stock availability and pricing in real-time

## Supabase Project

**Project URL**: `https://ajdehycoypilsegmxbto.supabase.co`

## Step 1: Get Your API Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ajdehycoypilsegmxbto)
2. Click on **Settings** (gear icon) → **API**
3. Copy the following keys:
   - **Project URL**: `https://ajdehycoypilsegmxbto.supabase.co`
   - **anon public key**: For client-side operations
   - **service_role key**: For server-side operations (keep secret!)

4. Add to your `.env` file:
```env
SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Step 2: Create Products Table

Run this SQL in the Supabase SQL Editor:

```sql
-- Create products table
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

-- Create index for faster searches
CREATE INDEX idx_products_name ON products USING GIN (to_tsvector('english', name));
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Step 3: Enable Vector Extension (for Semantic Search)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table for semantic search
CREATE TABLE IF NOT EXISTS product_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content TEXT, -- The text that was embedded
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX ON product_embeddings USING ivfflat (embedding vector_cosine_ops);
```

## Step 4: Create Vector Search Function

```sql
-- Function to search products by similarity
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
```

## Step 5: Set Up Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust based on your needs)
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
```

## Step 6: Insert Sample Products

```sql
-- Insert sample products
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
  );
```

## Step 7: Generate Embeddings for Products

Create a Node.js script to generate and store embeddings:

```javascript
// scripts/generate-embeddings.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbeddings() {
  // Fetch all products
  const { data: products, error } = await supabase
    .from('products')
    .select('*');

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  for (const product of products) {
    // Create text to embed (combine name, description, features)
    const textToEmbed = `${product.name} ${product.description} ${product.features?.join(' ') || ''}`;

    // Generate embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
    });

    const embedding = response.data[0].embedding;

    // Store embedding
    const { error: insertError } = await supabase
      .from('product_embeddings')
      .insert({
        product_id: product.id,
        embedding: embedding,
        content: textToEmbed,
      });

    if (insertError) {
      console.error('Error inserting embedding:', insertError);
    } else {
      console.log(`✓ Generated embedding for: ${product.name}`);
    }
  }

  console.log('Done!');
}

generateEmbeddings();
```

Run the script:
```bash
node scripts/generate-embeddings.js
```

## Step 8: Test Your Setup

Create a test script:

```javascript
// scripts/test-product-search.js
import { productService } from '../src/services/product.js';

async function testSearch() {
  console.log('Testing product search...\n');

  // Test 1: Search by name
  console.log('1. Search by name "Sony TV":');
  const byName = await productService.findProductByName('Sony TV');
  console.log(`Found ${byName.length} products\n`);

  // Test 2: Search by SKU
  console.log('2. Search by SKU:');
  const bySku = await productService.findProductBySKU('TV-SONY-55-4K');
  console.log(bySku ? 'Found product' : 'Not found', '\n');

  // Test 3: Semantic search
  console.log('3. Semantic search "latest 55-inch television":');
  const semantic = await productService.semanticSearch('latest 55-inch television');
  console.log(`Found ${semantic.length} products\n`);

  // Test 4: Check availability
  if (bySku) {
    console.log('4. Check availability:');
    const availability = await productService.checkAvailability(bySku.id);
    console.log(availability);
  }
}

testSearch();
```

Run the test:
```bash
node scripts/test-product-search.js
```

## Step 9: Enable in Your Application

The product service is already integrated! Your AI agent will automatically:

1. **Search products** when customers ask about them
2. **Check availability** for stock information
3. **Provide pricing** with currency and discounts
4. **Suggest alternatives** if products are out of stock

## How It Works

### When a customer calls and asks:
> "Tell me about your 55-inch Sony TV"

**Flow:**
1. Speech recognized: "Tell me about your 55-inch Sony TV"
2. Claude decides to use the `get_product_info` tool
3. Product service performs semantic search in Supabase
4. Retrieves product details (price, stock, features)
5. Claude receives the data and formulates response
6. TTS generates South African voice: "Ja, we have the Sony 55-inch 4K Smart TV available for R12,999..."

## Maintaining Your Product Data

### Adding Products

```sql
INSERT INTO products (sku, name, description, category, price, stock_level)
VALUES ('YOUR-SKU', 'Product Name', 'Description', 'Category', 999.99, 10);
```

After adding, run `generate-embeddings.js` to create embeddings for new products.

### Updating Products

```sql
UPDATE products
SET price = 11999.99, stock_level = 20
WHERE sku = 'TV-SONY-55-4K';
```

### Bulk Import

Use Supabase's CSV import feature:
1. Go to Table Editor → Products
2. Click "Insert" → "Import data from CSV"
3. Upload your product CSV
4. Map columns and import
5. Run embedding generation script

## Advanced Features

### 1. Category-based Search

```javascript
const tvs = await productService.findProductsByCategory('Electronics');
```

### 2. Price Filtering

Add to your SQL:
```sql
SELECT * FROM products WHERE price BETWEEN 10000 AND 20000;
```

### 3. Featured Products

Add a `featured` column and promote certain products.

### 4. Product Relationships

Create tables for:
- Accessories (linked products)
- Related products
- Frequently bought together

## Troubleshooting

### Error: "relation 'products' does not exist"
- Run the CREATE TABLE SQL from Step 2

### Error: "extension 'vector' does not exist"
- Run `CREATE EXTENSION vector;` as a superuser
- Or enable it in Supabase Dashboard → Database → Extensions

### Semantic search not working
- Verify embeddings table has data
- Check vector dimension matches (1536 for text-embedding-3-small)
- Ensure match_products function is created

### Products not found
- Check RLS policies allow read access
- Verify data exists: `SELECT COUNT(*) FROM products;`
- Test with direct Supabase query in dashboard

## Cost Considerations

### OpenAI Embeddings
- **text-embedding-3-small**: $0.02 per 1M tokens
- Average product: ~100 tokens
- 1000 products: ~$0.002 (very cheap!)

### Supabase
- Free tier includes:
  - 500MB database
  - 1GB file storage
  - 2GB bandwidth
- Should be sufficient for most product catalogues

## Security Best Practices

1. **Never commit** your service role key
2. **Use RLS policies** to restrict access
3. **Validate input** in your application
4. **Rate limit** API calls
5. **Monitor usage** in Supabase dashboard

## Next Steps

1. Import your actual product catalogue
2. Generate embeddings for all products
3. Test searches with various queries
4. Customize product fields for your needs
5. Add product images and specifications
6. Set up automated stock updates

---

**Your AI agent now has access to your complete product catalogue!** 🎉

When customers call and ask about products, the AI will search Supabase, retrieve accurate information, and provide helpful responses with pricing, availability, and features.
