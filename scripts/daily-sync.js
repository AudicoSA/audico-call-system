/**
 * Daily Sync Script
 *
 * Automatically:
 * 1. Import new products from main products table
 * 2. Enhance them with AI knowledge
 * 3. Update existing products if changed
 *
 * Run this once per day (via cron/Task Scheduler)
 */

import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('🔄 Daily Sync Script');
console.log('Time:', new Date().toLocaleString());
console.log('='.repeat(60));

// Helpers
const truncate = (str, max = 255) => {
  if (!str) return '';
  return str.length > max ? str.substring(0, max - 3) + '...' : str;
};

function categorize(product) {
  if (product.category_name) return product.category_name;
  const text = `${product.product_name} ${product.description || ''}`.toLowerCase();
  if (text.match(/\b(receiver|avr|amplifier)\b/)) return 'AV Receivers';
  if (text.match(/\b(speaker|subwoofer|soundbar)\b/)) return 'Speakers';
  if (text.match(/\b(tv|television|display)\b/)) return 'TVs & Displays';
  if (text.match(/\b(headphone|earbud)\b/)) return 'Headphones & Earbuds';
  return 'Electronics';
}

async function extractKnowledge(product) {
  const prompt = `Analyze this product and extract structured technical information in JSON format.

Product: ${product.name}
SKU: ${product.sku || 'N/A'}
Category: ${product.category || 'Unknown'}
Description: ${product.description || 'No description available'}

Extract the following information (set to null if not found):
{
  "key_features": ["array", "of", "main", "features"],
  "technical_specs": {
    "spec_name": "spec_value"
  },
  "compatibility": ["what", "it", "works", "with"],
  "common_uses": ["typical", "use", "cases"],
  "setup_notes": ["brief", "setup", "tips"],
  "common_questions": [
    {
      "q": "Common question customers ask?",
      "a": "Brief answer"
    }
  ]
}

Return ONLY valid JSON. Be concise and factual.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a technical product analyst. Extract structured information from product descriptions. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`  ❌ Error extracting knowledge for ${product.sku}:`, error.message);
    return null;
  }
}

async function main() {
  let stats = {
    newProducts: 0,
    updatedProducts: 0,
    enhanced: 0,
    errors: 0,
  };

  try {
    // Step 1: Find new products (in main table but not in call_center_products)
    console.log('\n📋 Step 1: Finding new products...');

    const { data: existingSkus } = await supabase
      .from('call_center_products')
      .select('sku');

    const existingSkuSet = new Set(existingSkus.map(p => p.sku));

    // Fetch all active products from main table
    let allProducts = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data: batch } = await supabase
        .from('products')
        .select('*')
        .not('product_name', 'is', null)
        .eq('active', true)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!batch || batch.length === 0) break;
      allProducts = allProducts.concat(batch);
      if (batch.length < pageSize) break;
      page++;
    }

    console.log(`  Found ${allProducts.length} active products in main table`);

    const newProducts = allProducts.filter(p => !existingSkuSet.has(p.sku));
    console.log(`  Found ${newProducts.length} new products to import`);

    // Step 2: Import new products
    if (newProducts.length > 0) {
      console.log('\n📥 Step 2: Importing new products...');

      for (const p of newProducts) {
        const converted = {
          sku: truncate(p.sku || p.model || `P-${p.id}`, 100),
          name: truncate(p.product_name, 255),
          description: p.description || '',
          category: truncate(categorize(p), 100),
          price: parseFloat(p.selling_price || p.retail_price || 0),
          currency: 'ZAR',
          stock_level: parseInt(p.total_stock || 0),
          features: p.features,
          specifications: {
            original_id: p.id,
            brand: p.brand,
            model: p.model,
            opencart_product_id: p.opencart_product_id
          }
        };

        const { error } = await supabase
          .from('call_center_products')
          .upsert(converted, { onConflict: 'sku' });

        if (error) {
          console.error(`  ❌ ${converted.sku}: ${error.message}`);
          stats.errors++;
        } else {
          stats.newProducts++;
          if (stats.newProducts % 10 === 0) {
            console.log(`    Imported ${stats.newProducts}/${newProducts.length}...`);
          }
        }
      }

      console.log(`  ✅ Imported ${stats.newProducts} new products`);
    }

    // Step 3: Find products needing enhancement
    console.log('\n🤖 Step 3: Enhancing products with AI knowledge...');

    let unenhancedProducts = [];
    page = 0;

    while (true) {
      const { data: batch } = await supabase
        .from('call_center_products')
        .select('id, sku, name, description, category')
        .is('enhanced_knowledge', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!batch || batch.length === 0) break;
      unenhancedProducts = unenhancedProducts.concat(batch);
      if (batch.length < pageSize) break;
      page++;
    }

    console.log(`  Found ${unenhancedProducts.length} products without AI knowledge`);

    // Enhance products (process in batches to manage API costs)
    const enhanceLimit = 100; // Only enhance 100 per day (adjust as needed)
    const toEnhance = unenhancedProducts.slice(0, enhanceLimit);

    if (toEnhance.length > 0) {
      console.log(`  Enhancing ${toEnhance.length} products...`);

      for (let i = 0; i < toEnhance.length; i++) {
        const product = toEnhance[i];

        const knowledge = await extractKnowledge(product);

        if (knowledge) {
          const { error } = await supabase
            .from('call_center_products')
            .update({
              enhanced_knowledge: knowledge,
              knowledge_updated_at: new Date().toISOString()
            })
            .eq('id', product.id);

          if (!error) {
            stats.enhanced++;
          } else {
            stats.errors++;
          }
        }

        if ((i + 1) % 10 === 0) {
          console.log(`    Enhanced ${i + 1}/${toEnhance.length}...`);
          // Delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`  ✅ Enhanced ${stats.enhanced} products`);

      if (unenhancedProducts.length > enhanceLimit) {
        console.log(`  ⏳ ${unenhancedProducts.length - enhanceLimit} products remaining for next run`);
      }
    }

    // Step 4: Update changed products (price, stock, description updates)
    console.log('\n🔄 Step 4: Checking for product updates...');

    // Get products updated in last 24 hours from main table
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentlyUpdated } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .gte('last_updated', yesterday.toISOString())
      .limit(1000);

    if (recentlyUpdated && recentlyUpdated.length > 0) {
      console.log(`  Found ${recentlyUpdated.length} recently updated products`);

      for (const p of recentlyUpdated) {
        const updates = {
          name: truncate(p.product_name, 255),
          description: p.description || '',
          price: parseFloat(p.selling_price || p.retail_price || 0),
          stock_level: parseInt(p.total_stock || 0),
        };

        const { error } = await supabase
          .from('call_center_products')
          .update(updates)
          .eq('sku', p.sku);

        if (!error) {
          stats.updatedProducts++;
        }
      }

      console.log(`  ✅ Updated ${stats.updatedProducts} products`);
    } else {
      console.log(`  No products updated in last 24 hours`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DAILY SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`New products imported: ${stats.newProducts}`);
    console.log(`Products updated: ${stats.updatedProducts}`);
    console.log(`Products enhanced with AI: ${stats.enhanced}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60));

    // Estimated cost
    const costPerEnhancement = 0.00022;
    const cost = stats.enhanced * costPerEnhancement;
    console.log(`\n💰 Estimated OpenAI cost: $${cost.toFixed(4)} USD`);

    console.log('\n✅ Daily sync complete!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
