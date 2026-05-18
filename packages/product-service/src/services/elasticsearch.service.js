import { Client } from '@elastic/elasticsearch';
import { config, logger } from '@iuh-exchange/common';

const esClient = new Client({ node: config.elasticsearch.node });

const INDEX = 'products';

async function withRetry(fn, maxRetries = 3, baseDelayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`ES operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Ensure the products index exists with proper mappings.
 */
export async function ensureIndex() {
  try {
    const exists = await esClient.indices.exists({ index: INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX,
        body: {
          mappings: {
            properties: {
              title: { type: 'text', analyzer: 'standard' },
              description: { type: 'text', analyzer: 'standard' },
              price: { type: 'double' },
              category: { type: 'keyword' },
              location: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              condition: { type: 'keyword' },
              status: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      logger.info(`ElasticSearch index "${INDEX}" created`);
    } else {
      await esClient.indices.putMapping({
        index: INDEX,
        properties: {
          location: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          createdAt: { type: 'date' },
        },
      });
    }
  } catch (err) {
    logger.error(`ElasticSearch index setup failed: ${err.message}`);
  }
}

/**
 * Index or update a product document in ElasticSearch.
 * @param {object} product
 */
export async function indexProduct(product) {
  try {
    await withRetry(async () => {
      await esClient.index({
        index: INDEX,
        id: product.id,
        document: {
          title: product.title,
          description: product.description,
          price: product.price,
          category: product.category,
          location: product.location || '',
          condition: product.condition || 'GOOD',
          status: product.status,
          createdAt: product.createdAt || new Date().toISOString(),
        },
      });
    });
    logger.info(`ES indexed product: ${product.id}`);
  } catch (err) {
    logger.error(`ES index failed for ${product.id} after retries: ${err.message}`);
  }
}

/**
 * Remove a product from ElasticSearch index.
 * @param {string} productId
 */
export async function removeProduct(productId) {
  try {
    await withRetry(async () => {
      await esClient.delete({ index: INDEX, id: productId }, { ignore: [404] });
    });
    logger.info(`ES removed product: ${productId}`);
  } catch (err) {
    logger.error(`ES delete failed for ${productId} after retries: ${err.message}`);
  }
}

/**
 * Search products in ElasticSearch with fuzzy matching and filters.
 * @param {string} keyword
 * @param {number} page - 1-based
 * @param {number} size
 * @param {object} [filters] - Optional filters
 * @param {number} [filters.minPrice] - Minimum price
 * @param {number} [filters.maxPrice] - Maximum price
 * @param {string} [filters.category] - Category filter
 * @param {string} [filters.condition] - Condition filter (NEW, LIKE_NEW, GOOD, FAIR, POOR)
 * @param {string} [filters.location] - Location filter
 * @param {string} [filters.sort] - Sort option (price_asc, price_desc, date_asc, date_desc)
 * @returns {Promise<{ hits: object[], total: number }>}
 */
export async function searchProducts(keyword, page = 1, size = 20, filters = {}) {
  const from = (page - 1) * size;

  try {
    // Build the bool query
    const must = [];
    const filterClauses = [{ term: { status: 'AVAILABLE' } }];

    // Keyword search (fuzzy)
    if (keyword && keyword.trim()) {
      must.push({
        multi_match: {
          query: keyword,
          fields: ['title^2', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    // Price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const priceRange = {};
      if (filters.minPrice !== undefined) priceRange.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceRange.lte = filters.maxPrice;
      filterClauses.push({ range: { price: priceRange } });
    }

    // Category filter
    if (filters.category) {
      filterClauses.push({ term: { category: filters.category } });
    }

    // Condition filter
    if (filters.condition) {
      filterClauses.push({ term: { condition: filters.condition } });
    }

    if (filters.location) {
      filterClauses.push({ match: { location: filters.location } });
    }

    // Build sort
    let sort = [];
    if (filters.sort) {
      switch (filters.sort) {
        case 'price_asc':
          sort = [{ price: 'asc' }, '_score'];
          break;
        case 'price_desc':
          sort = [{ price: 'desc' }, '_score'];
          break;
        case 'date_asc':
          sort = [{ createdAt: 'asc' }, '_score'];
          break;
        case 'date_desc':
          sort = [{ createdAt: 'desc' }, '_score'];
          break;
        default:
          sort = ['_score'];
      }
    }

    const result = await esClient.search({
      index: INDEX,
      from,
      size,
      query: {
        bool: {
          must,
          filter: filterClauses,
        },
      },
      ...(sort.length > 0 ? { sort } : {}),
    });

    return {
      hits: result.hits.hits.map((h) => ({ id: h._id, ...h._source })),
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total.value,
    };
  } catch (err) {
    logger.error(`ES search failed: ${err.message}`);
    return { hits: [], total: 0 };
  }
}

/**
 * Autocomplete product titles/categories/locations.
 * @param {string} keyword
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function suggestProducts(keyword, limit = 8) {
  if (!keyword || keyword.trim().length < 2) return [];

  try {
    const result = await esClient.search({
      index: INDEX,
      size: limit,
      query: {
        bool: {
          filter: [{ term: { status: 'AVAILABLE' } }],
          should: [
            { match_phrase_prefix: { title: { query: keyword, boost: 3 } } },
            { prefix: { category: { value: keyword, boost: 2, case_insensitive: true } } },
            { match_phrase_prefix: { location: { query: keyword } } },
          ],
          minimum_should_match: 1,
        },
      },
      _source: ['title', 'category', 'location'],
    });

    return result.hits.hits.map((hit) => ({
      id: hit._id,
      title: hit._source.title,
      category: hit._source.category,
      location: hit._source.location,
    }));
  } catch (err) {
    logger.error(`ES suggest failed: ${err.message}`);
    return [];
  }
}
