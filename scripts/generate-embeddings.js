#!/usr/bin/env node

/**
 * Generate embeddings for products in Supabase
 * This enables semantic search for product queries
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('🔄 Product Embedding Generator\n');
console.log('====================================\n');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding for a text string
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Generate and store embeddings for all products
 */
async function generateAllEmbeddings() {
  try {
    // Fetch all products from call center products table (NOT quoting system's products table)
    console.log('📥 Fetching call center products from Supabase...');
    const { data: products, error: fetchError } = await supabase
      .from('call_center_products')
      .select('*');

    if (fetchError) {
      throw new Error(`Error fetching products: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      console.log('⚠️  No products found in database');
      console.log('💡 Add products to Supabase first before generating embeddings\n');
      return;
    }

    console.log(`✅ Found ${products.length} products\n`);

    // Check if call_center_product_embeddings table exists
    const { error: tableError } = await supabase
      .from('call_center_product_embeddings')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      console.error('❌ Table "call_center_product_embeddings" does not exist');
      console.log('💡 Run supabase-setup-safe.sql first\n');
      return;
    }

    // Generate embeddings for each product
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const product of products) {
      process.stdout.write(`Processing: ${product.name}... `);

      // Check if embedding already exists
      const { data: existing } = await supabase
        .from('call_center_product_embeddings')
        .select('id')
        .eq('product_id', product.id)
        .single();

      if (existing) {
        console.log('⏭️  (already exists)');
        skipCount++;
        continue;
      }

      try {
        // Create text to embed (combine name, description, features, category)
        const parts = [
          product.name,
          product.description || '',
          product.category || '',
          (product.features && Array.isArray(product.features))
            ? product.features.join(' ')
            : '',
        ];

        const textToEmbed = parts.filter(p => p).join(' ');

        // Generate embedding
        const embedding = await generateEmbedding(textToEmbed);

        // Store embedding in Supabase
        const { error: insertError } = await supabase
          .from('call_center_product_embeddings')
          .insert({
            product_id: product.id,
            embedding: embedding,
            content: textToEmbed,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        console.log('✅');
        successCount++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`❌ ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n====================================');
    console.log('📊 Summary:');
    console.log(`   ✅ Generated: ${successCount}`);
    console.log(`   ⏭️  Skipped:   ${skipCount}`);
    console.log(`   ❌ Errors:    ${errorCount}`);
    console.log('====================================\n');

    if (successCount > 0) {
      console.log('🎉 Embeddings generated successfully!');
      console.log('💡 Your AI agent can now perform semantic product search\n');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. SUPABASE_URL is set correctly');
    console.error('2. SUPABASE_SERVICE_ROLE_KEY is valid');
    console.error('3. OPENAI_API_KEY is valid');
    console.error('4. Products table exists and has data');
    console.error('5. Product_embeddings table is created (see SUPABASE_SETUP.md)\n');
    process.exit(1);
  }
}

/**
 * Regenerate embeddings for a specific product
 */
async function regenerateEmbedding(productId) {
  try {
    console.log(`🔄 Regenerating embedding for product ID: ${productId}\n`);

    // Fetch product
    const { data: product, error: fetchError } = await supabase
      .from('call_center_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      throw new Error('Product not found');
    }

    // Create text to embed
    const parts = [
      product.name,
      product.description || '',
      product.category || '',
      (product.features && Array.isArray(product.features))
        ? product.features.join(' ')
        : '',
    ];

    const textToEmbed = parts.filter(p => p).join(' ');

    // Generate embedding
    const embedding = await generateEmbedding(textToEmbed);

    // Delete old embedding
    await supabase
      .from('call_center_product_embeddings')
      .delete()
      .eq('product_id', productId);

    // Insert new embedding
    const { error: insertError } = await supabase
      .from('call_center_product_embeddings')
      .insert({
        product_id: product.id,
        embedding: embedding,
        content: textToEmbed,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    console.log('✅ Embedding regenerated successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'regenerate' && args[1]) {
  // Regenerate embedding for specific product
  regenerateEmbedding(args[1]);
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log('Usage:');
  console.log('  node scripts/generate-embeddings.js           Generate all embeddings');
  console.log('  node scripts/generate-embeddings.js regenerate <product_id>');
  console.log('                                                 Regenerate for specific product');
  console.log('  node scripts/generate-embeddings.js help      Show this help\n');
} else {
  // Generate all embeddings
  generateAllEmbeddings();
}
