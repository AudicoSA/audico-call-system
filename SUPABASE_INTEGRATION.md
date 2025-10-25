# Supabase Integration - Product Knowledge with RAG

## Overview

Your Audico Call System now includes **Retrieval-Augmented Generation (RAG)** powered by Supabase! This means your AI agent can answer product questions with accurate, real-time information from your database.

## What's New

### ✨ Features Added

1. **Product Service** ([src/services/product.js](src/services/product.js))
   - Search products by name, SKU, or category
   - Semantic search using vector embeddings
   - Check stock availability in real-time
   - Get pricing with discounts
   - Product recommendations

2. **LLM Tool Calling** ([src/services/llm.js](src/services/llm.js))
   - Claude can now call product tools automatically
   - `get_product_info` - Search for products
   - `check_product_availability` - Check stock levels
   - `get_product_recommendations` - Suggest alternatives

3. **Vector Search** ([scripts/generate-embeddings.js](scripts/generate-embeddings.js))
   - Semantic search: "latest 55-inch TV" finds relevant products
   - Not just keyword matching
   - Powered by OpenAI embeddings + pgvector

4. **Updated Voice Routes**
   - AI conversations now use `generateResponseWithTools()`
   - Automatic product lookup when customers ask questions

## How It Works

### Example Conversation

**Customer**: "Howzit, I'm looking for a Sony TV around 55 inches"

**Flow**:
1. 🎤 Speech recognized by Whisper
2. 🤖 Claude receives message
3. 🔧 Claude decides to use `get_product_info` tool
4. 🔍 Product service searches Supabase (semantic search)
5. 📊 Returns: Sony 55" 4K Smart TV - R12,999, 15 in stock
6. 🤖 Claude formulates natural response
7. 🗣️ ElevenLabs TTS with SA voice: "Ja, we have the Sony 55-inch 4K Smart TV available..."

### Without RAG (Before)
> AI: "Let me connect you to someone who can help with that..."

### With RAG (Now)
> AI: "Ja, we have the Sony 55-inch 4K Smart TV available for R12,999. It's a lekker TV with 4K Ultra HD, HDR support, and built-in Android TV. We have 15 units in stock. Would you like to know more about it?"

## Setup Steps

### 1. Configure Supabase

Add to your `.env`:
```env
SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

Get keys from: [Supabase Dashboard](https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/settings/api)

### 2. Create Database Tables

Run SQL from [SUPABASE_SETUP.md](SUPABASE_SETUP.md):
- `products` table
- `product_embeddings` table (for vector search)
- `match_products()` function
- Row Level Security policies

### 3. Add Your Products

Insert products via SQL or CSV import:
```sql
INSERT INTO products (sku, name, description, category, price, stock_level)
VALUES ('TV-001', 'Sony 55" 4K TV', 'Amazing TV...', 'Electronics', 12999.99, 15);
```

### 4. Generate Embeddings

Run the embedding script:
```bash
node scripts/generate-embeddings.js
```

This creates vector embeddings for semantic search.

### 5. Test It

```bash
npm start
# Call your Twilio number
# Ask: "Tell me about your Sony TV"
```

## New Files

| File | Purpose |
|------|---------|
| `src/services/product.js` | Product search with RAG |
| `scripts/generate-embeddings.js` | Create vector embeddings |
| `SUPABASE_SETUP.md` | Detailed setup guide |
| `SUPABASE_INTEGRATION.md` | This file |

## Updated Files

| File | Changes |
|------|---------|
| `src/services/llm.js` | Added tool calling methods |
| `src/routes/voice.js` | Use `generateResponseWithTools()` |
| `src/config/config.js` | Added Supabase config |
| `.env.example` | Added Supabase variables |
| `package.json` | Added `@supabase/supabase-js` |
| `README.md` | Updated features and architecture |

## RAG vs Traditional Approach

### Traditional (Without RAG)
```
Customer: "Do you have the Sony 55-inch TV?"
AI: "Let me transfer you to our sales team..."
[Transfer to human - takes 2-5 minutes]
```

### RAG-Powered (With Supabase)
```
Customer: "Do you have the Sony 55-inch TV?"
AI: [Searches Supabase]
AI: "Yes! The Sony 55-inch 4K Smart TV is R12,999.
     We have 15 in stock. It has 4K Ultra HD, HDR support..."
Customer: "What about a 65-inch version?"
AI: [Searches again]
AI: "We have the Samsung 65-inch QLED for R18,999..."
[Resolved in 30 seconds - no transfer needed!]
```

## Benefits

1. **Faster Resolution** - Answer product questions instantly
2. **Accurate Information** - Always up-to-date from database
3. **Reduced Transfers** - AI handles more calls autonomously
4. **Better Experience** - Customers get immediate answers
5. **Cost Savings** - Fewer human agent hours needed

## Product Tool Examples

### 1. Get Product Info
**User**: "Tell me about your Sony TV"
```javascript
Tool: get_product_info
Input: { query: "Sony TV", search_type: "semantic" }
Output: "Sony 55" 4K Smart TV (SKU: TV-SONY-55-4K)
         Price: ZAR 12999.99
         In stock: 15 units available..."
```

### 2. Check Availability
**User**: "Is the iPhone 15 in stock?"
```javascript
Tool: check_product_availability
Input: { product_id: "uuid-here" }
Output: { available: true, stockLevel: 25, message: "We have 25 units in stock" }
```

### 3. Get Recommendations
**User**: "What other headphones do you have?"
```javascript
Tool: get_product_recommendations
Input: { product_id: "uuid-here", limit: 3 }
Output: "Sony WH-1000XM5 (ZAR 5999.99), Bose QC45 (ZAR 6499.99)..."
```

## Semantic Search Examples

Semantic search understands **meaning**, not just keywords:

| Customer Says | Finds |
|---------------|-------|
| "latest 55-inch television" | Sony 55" 4K TV |
| "noise cancelling earphones" | Sony WH-1000XM5 Headphones |
| "phone with good camera" | iPhone 15 Pro |
| "laptop for work" | Dell XPS 13 Laptop |

## Maintaining Product Data

### Adding Products
1. Insert into `products` table
2. Run `node scripts/generate-embeddings.js`
3. Done!

### Updating Stock
```sql
UPDATE products SET stock_level = 20 WHERE sku = 'TV-SONY-55-4K';
```
No need to regenerate embeddings for stock updates.

### Updating Product Details
```sql
UPDATE products SET price = 11999.99, description = 'New description' WHERE sku = 'TV-001';
```
Run `node scripts/generate-embeddings.js regenerate <product_id>` if description changes.

## Monitoring

### Check Product Cache
The product service caches frequently accessed products for 5 minutes.

```javascript
// In your code
productService.clearCache(); // Clear if needed
```

### View Tool Usage
Check logs for tool executions:
```
[LLM] Executing product tool: get_product_info { query: 'Sony TV', search_type: 'semantic' }
[Product] Semantic search: Sony TV
[Product] Found 3 products via semantic search
```

## Troubleshooting

### "No products found"
- Check products exist: `SELECT * FROM products;`
- Verify RLS policies allow access
- Check embedding generation completed

### "Semantic search not working"
- Verify `product_embeddings` table has data
- Check `match_products()` function exists
- Ensure pgvector extension is enabled

### "Tool not being called"
- Check Claude's tool definitions in `src/services/llm.js`
- Verify system prompt mentions tools
- Review conversation logs

## Performance

### Latency
- Direct search: ~50-100ms
- Semantic search: ~100-200ms
- Cache hit: ~1ms

### Costs
- **Embeddings**: $0.02 per 1M tokens (very cheap!)
- **Supabase**: Free tier sufficient for most use cases
- **OpenAI**: Minimal cost for embedding generation

## Security

### API Keys
- ✅ Service role key stored in `.env` (server-side only)
- ✅ Never exposed to client
- ✅ Row Level Security enabled on tables

### Data Access
- ✅ RLS policies control access
- ✅ Public can only read (not modify)
- ✅ Service role has full access

## Next Steps

1. **Import Your Catalogue** - Add your actual products
2. **Customize Fields** - Add specifications, images, etc.
3. **Test Searches** - Try various product queries
4. **Monitor Usage** - Check Supabase dashboard
5. **Optimize** - Adjust caching, search thresholds

## Advanced Features

### Multi-language Support
Add language-specific embeddings for Afrikaans, Zulu, etc.

### Product Images
Store image URLs and send via SMS after call

### Inventory Integration
Real-time stock updates from your inventory system

### Price Rules
Dynamic pricing based on customer segment

### Recommendations Engine
Train on purchase history for better suggestions

## Resources

- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Detailed setup guide
- [Supabase Dashboard](https://supabase.com/dashboard/project/ajdehycoypilsegmxbto)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

---

**Your AI agent is now a product expert!** 🎉

Customers can ask about any product, check availability, compare options, and get instant accurate answers - all with a friendly South African voice.
