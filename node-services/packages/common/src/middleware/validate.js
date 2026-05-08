/**
 * Validation middleware factory.
 * Tạo middleware validate request body/query/params bằng Zod schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema
 * @param {'body'|'query'|'params'} source - Nguồn data cần validate
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      next(err); // errorHandler sẽ catch ZodError
    }
  };
}
