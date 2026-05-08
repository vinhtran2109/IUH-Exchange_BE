import { Client } from '@elastic/elasticsearch';
import { config, logger } from '@iuh-exchange/common';

const esClient = new Client({ node: config.elasticsearch.node });

const INDEX = 'products';

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
              status: { type: 'keyword' },
            },
          },
        },
      });
      logger.info(`ElasticSearch index "${INDEX}" created`);
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
    await esClient.index({
      index: INDEX,
      id: product.id,
      document: {
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        status: product.status,
      },
    });
    logger.info(`ES indexed product: ${product.id}`);
  } catch (err) {
    logger.error(`ES index failed for ${product.id}: ${err.message}`);
  }
}

/**
 * Remove a product from ElasticSearch index.
 * @param {string} productId
 */
export async function removeProduct(productId) {
  try {
    await esClient.delete({ index: INDEX, id: productId }, { ignore: [404] });
    logger.info(`ES removed product: ${productId}`);
  } catch (err) {
    logger.error(`ES delete failed for ${productId}: ${err.message}`);
  }
}

/**
 * Search products in ElasticSearch with fuzzy matching.
 * @param {string} keyword
 * @param {number} page - 1-based
 * @param {number} size
 * @returns {Promise<{ hits: object[], total: number }>}
 */
export async function searchProducts(keyword, page = 1, size = 20) {
  const from = (page - 1) * size;
  try {
    const result = await esClient.search({
      index: INDEX,
      from,
      size,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: keyword,
                fields: ['title^2', 'description'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ],
          filter: [{ term: { status: 'AVAILABLE' } }],
        },
      },
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
