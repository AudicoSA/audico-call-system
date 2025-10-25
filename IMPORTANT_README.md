# ⚠️ IMPORTANT: Your Products Table is Safe!

## ✅ Good News!

Your existing `products` table (used for the quoting system) is **NOT affected** by the call center setup.

## 🔄 What Changed

I've updated everything to use **separate tables** for the call center system:

### New Tables (Safe - Won't Touch Your Quoting System)

1. **`call_center_products`** - Products for AI agent to talk about
2. **`call_center_product_embeddings`** - Vector embeddings for semantic search
3. **`match_call_center_products()`** - Search function

### Your Original Tables (Untouched)

- **`products`** - Your quoting system products ✅ **Safe!**
- All your other quoting system tables ✅ **Safe!**

---

## 🚀 Setup Steps (Updated & Safe)

### Step 1: Run the Safe SQL Script

Use **`supabase-setup-safe.sql`** (NOT the other one):

1. Go to https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/sql
2. Click **"New Query"**
3. Open `supabase-setup-safe.sql`
4. Copy the **entire file**
5. Paste into Supabase SQL Editor
6. Click **"Run"**

This creates NEW tables without touching your `products` table.

---

### Step 2: Generate Embeddings

```bash
npm install
node scripts/generate-embeddings.js
```

The script now uses `call_center_products` table only.

---

### Step 3: Test Everything

```bash
node scripts/test-services.js
npm start
```

---

## 📊 What You Have Now

### Quoting System (Unchanged)
```
products table → Your quotes, invoices, etc.
```

### Call Center System (New & Separate)
```
call_center_products → AI agent product knowledge
call_center_product_embeddings → For semantic search
```

**They don't interfere with each other!** ✅

---

## 🔧 Files Updated

All these files now use the **safe tables**:

- ✅ `src/services/product.js` - Uses `call_center_products`
- ✅ `scripts/generate-embeddings.js` - Uses `call_center_products`
- ✅ `supabase-setup-safe.sql` - Creates safe tables

---

## 💡 How to Add Products for the Call Center

You have 2 options:

### Option A: Sync from Your Quoting Products

Create a script to copy products from `products` to `call_center_products`:

```sql
INSERT INTO call_center_products (sku, name, description, category, price, stock_level)
SELECT sku, name, description, category, price, stock_level
FROM products
WHERE active = true
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  stock_level = EXCLUDED.stock_level;
```

### Option B: Add Manually

```sql
INSERT INTO call_center_products (sku, name, description, category, price, stock_level)
VALUES ('YOUR-SKU', 'Product Name', 'Description', 'Category', 999.99, 10);
```

Then run: `node scripts/generate-embeddings.js`

---

## 🎯 Quick Reference

| File | Purpose |
|------|---------|
| `supabase-setup-safe.sql` | ✅ **Use This!** Safe setup |
| `supabase-setup-clean.sql` | ❌ **DON'T USE!** Drops tables |
| `supabase-setup.sql` | ❌ **DON'T USE!** Had typo + wrong tables |

---

## 🔐 Your Data is Safe

- ✅ `products` table untouched
- ✅ Quoting system unchanged
- ✅ New tables are separate
- ✅ No data loss

---

## ✨ Next Steps

1. Run **`supabase-setup-safe.sql`** in Supabase
2. Run **`node scripts/generate-embeddings.js`**
3. Complete your `.env` file (Twilio + ElevenLabs Voice ID)
4. Test with **`npm start`**

---

**Everything is safe!** The call center system and quoting system use completely different tables. 🎉
