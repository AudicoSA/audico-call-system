import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { config } from '../config/config.js';

/**
 * Product Knowledge Service with RAG (Retrieval-Augmented Generation)
 * Provides product information retrieval from Supabase with semantic search
 *
 * IMPORTANT: Uses 'call_center_products' table (separate from your quoting system's 'products' table)
 */
export class ProductService {
  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey || config.supabase.anonKey
    );

    // Initialize OpenAI for embeddings (used for semantic search)
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    // Cache for frequently accessed products
    this.productCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Table name (separate from quoting system)
    this.tableName = 'call_center_products';
    this.embeddingsTable = 'call_center_product_embeddings';
    this.matchFunction = 'match_call_center_products';
  }

  /**
   * Search products by name (direct lookup)
   * @param {string} productName - Product name to search
   * @returns {Promise<Array>} - Array of matching products
   */
  async findProductByName(productName) {
    try {
      console.log('[Product] Searching by name:', productName);

      const { data, error} = await this.supabase
        .from(this.tableName)
        .select('*')
        .ilike('name', `%${productName}%`)
        .limit(5);

      if (error) {
        console.error('[Product] Error searching by name:', error);
        return [];
      }

      console.log(`[Product] Found ${data?.length || 0} products`);
      return data || [];
    } catch (error) {
      console.error('[Product] Exception searching by name:', error.message);
      return [];
    }
  }

  /**
   * Search products by SKU
   * @param {string} sku - Product SKU
   * @returns {Promise<object|null>} - Product object or null
   */
  async findProductBySKU(sku) {
    try {
      console.log('[Product] Searching by SKU:', sku);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('sku', sku)
        .single();

      if (error) {
        console.error('[Product] Error searching by SKU:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Product] Exception searching by SKU:', error.message);
      return null;
    }
  }

  /**
   * Search products by category
   * @param {string} category - Product category
   * @returns {Promise<Array>} - Array of products in category
   */
  async findProductsByCategory(category) {
    try {
      console.log('[Product] Searching by category:', category);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .ilike('category', `%${category}%`)
        .limit(10);

      if (error) {
        console.error('[Product] Error searching by category:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Product] Exception searching by category:', error.message);
      return [];
    }
  }

  /**
   * Semantic search using embeddings and vector similarity
   * For flexible queries like "latest 55-inch Samsung TV"
   * @param {string} query - Natural language query
   * @param {number} limit - Number of results to return
   * @returns {Promise<Array>} - Array of relevant products
   */
  async semanticSearch(query, limit = 5) {
    try {
      console.log('[Product] Semantic search:', query);

      // Generate embedding for the search query
      const embedding = await this.generateEmbedding(query);

      // Perform vector similarity search
      const { data, error } = await this.supabase.rpc(this.matchFunction, {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit,
      });

      if (error) {
        console.error('[Product] Vector search error:', error);
        // Fallback to keyword search
        return this.keywordSearch(query, limit);
      }

      console.log(`[Product] Found ${data?.length || 0} products via semantic search`);
      return data || [];
    } catch (error) {
      console.error('[Product] Semantic search exception:', error.message);
      // Fallback to keyword search
      return this.keywordSearch(query, limit);
    }
  }

  /**
   * Generate embedding for text using OpenAI
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} - Embedding vector
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[Product] Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Fallback keyword search
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} - Matching products
   */
  async keywordSearch(query, limit = 5) {
    try {
      console.log('[Product] Keyword search fallback:', query);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        console.error('[Product] Keyword search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Product] Keyword search exception:', error.message);
      return [];
    }
  }

  /**
   * Get product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<object|null>} - Product object
   */
  async getProductById(productId) {
    try {
      // Check cache first
      const cacheKey = `product_${productId}`;
      const cached = this.productCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('[Product] Cache hit for:', productId);
        return cached.data;
      }

      console.log('[Product] Fetching product by ID:', productId);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('[Product] Error fetching by ID:', error);
        return null;
      }

      // Cache the result
      this.productCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('[Product] Exception fetching by ID:', error.message);
      return null;
    }
  }

  /**
   * Check product availability/stock
   * @param {string} productId - Product ID
   * @returns {Promise<object>} - Availability information
   */
  async checkAvailability(productId) {
    try {
      const product = await this.getProductById(productId);

      if (!product) {
        return {
          available: false,
          message: 'Product not found',
        };
      }

      const inStock = product.stock_level && product.stock_level > 0;

      return {
        available: inStock,
        stockLevel: product.stock_level || 0,
        message: inStock
          ? `We have ${product.stock_level} units in stock`
          : 'Currently out of stock',
        estimatedRestock: product.estimated_restock || null,
      };
    } catch (error) {
      console.error('[Product] Error checking availability:', error.message);
      return {
        available: false,
        message: 'Unable to check availability',
      };
    }
  }

  /**
   * Get product recommendations based on a product
   * @param {string} productId - Product ID
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Array of recommended products
   */
  async getRecommendations(productId, limit = 3) {
    try {
      const product = await this.getProductById(productId);

      if (!product) {
        return [];
      }

      // Find similar products in the same category
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('category', product.category)
        .neq('id', productId)
        .limit(limit);

      if (error) {
        console.error('[Product] Error getting recommendations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Product] Exception getting recommendations:', error.message);
      return [];
    }
  }

  /**
   * Get product price and discount information
   * @param {string} productId - Product ID
   * @returns {Promise<object>} - Price information
   */
  async getPricing(productId) {
    try {
      const product = await this.getProductById(productId);

      if (!product) {
        return null;
      }

      return {
        price: product.price,
        currency: product.currency || 'ZAR',
        discount: product.discount || 0,
        finalPrice: product.discount
          ? product.price * (1 - product.discount / 100)
          : product.price,
        onSale: product.on_sale || false,
      };
    } catch (error) {
      console.error('[Product] Error getting pricing:', error.message);
      return null;
    }
  }

  /**
   * Format product information for AI agent response
   * @param {object} product - Product object from database
   * @returns {string} - Formatted product information
   */
  formatProductInfo(product) {
    if (!product) {
      return 'Product information not available.';
    }

    let info = `${product.name}`;

    if (product.sku) {
      info += ` (SKU: ${product.sku})`;
    }

    if (product.description) {
      info += `\n${product.description}`;
    }

    if (product.price) {
      const currency = product.currency || 'ZAR';
      info += `\nPrice: ${currency} ${product.price.toFixed(2)}`;

      if (product.discount) {
        const discountedPrice = product.price * (1 - product.discount / 100);
        info += ` (${product.discount}% off - now ${currency} ${discountedPrice.toFixed(2)})`;
      }
    }

    if (product.stock_level !== undefined) {
      if (product.stock_level > 0) {
        info += `\nIn stock: ${product.stock_level} units available`;
      } else {
        info += '\nCurrently out of stock';
        if (product.estimated_restock) {
          info += ` - Expected back: ${product.estimated_restock}`;
        }
      }
    }

    if (product.features && Array.isArray(product.features)) {
      info += '\nKey features: ' + product.features.join(', ');
    }

    return info;
  }

  /**
   * Clear product cache
   */
  clearCache() {
    this.productCache.clear();
    console.log('[Product] Cache cleared');
  }
}

// Singleton instance
export const productService = new ProductService();
