import { createClient } from '@supabase/supabase-js';
import { ObjectId } from 'mongodb';

let supabaseClient;

export function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabaseClient;
}

export async function pingSupabase() {
  const { error } = await getSupabase().from('users').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) throw error;
}

function toSnake(key) {
  if (key === '_id') return 'id';
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamel(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function maybeDate(key, value) {
  if (typeof value !== 'string') return value;
  if (!/(At|Time|Until|Expiry)$/.test(key)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}

function docToPlain(doc) {
  const plain = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith('_') && key !== '_id') continue;
    if (typeof value === 'function') continue;
    plain[key] = value;
  }
  return plain;
}

function rowToPlain(row) {
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};
  const plain = { ...raw };
  for (const [key, value] of Object.entries(row)) {
    if (key === 'raw') continue;
    const camelKey = toCamel(key);
    plain[camelKey] = maybeDate(camelKey, value);
  }
  plain._id = row.id;
  return plain;
}

class SupabaseDocument {
  constructor(model, data = {}) {
    Object.defineProperty(this, '_model', { value: model, enumerable: false });
    Object.assign(this, data);
    this._id = data._id || data.id || new ObjectId().toHexString();
  }

  async save() {
    this.updatedAt = new Date();
    await this._model._upsertDocument(this);
    return this;
  }

  toObject() {
    return docToPlain(this);
  }

  toJSON() {
    return this.toObject();
  }
}

function matchesValue(actual, expected) {
  if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
    if ('$ne' in expected && actual === expected.$ne) return false;
    if ('$lt' in expected && !(actual < expected.$lt)) return false;
    if ('$gt' in expected && !(actual > expected.$gt)) return false;
    if ('$in' in expected && !expected.$in.includes(actual)) return false;
    return true;
  }
  return actual === expected;
}

function matchesFilter(item, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((candidate) => matchesFilter(item, candidate));
    return matchesValue(item[key], expected);
  });
}

function applyProjection(item, projection) {
  if (!projection) return item;
  const fields = String(projection).split(/\s+/).filter(Boolean);
  const excludes = fields.filter((field) => field.startsWith('-')).map((field) => field.slice(1));
  if (excludes.length > 0) {
    const copy = { ...item };
    for (const field of excludes) delete copy[field];
    return copy;
  }
  const includes = new Set(fields);
  const copy = { _id: item._id };
  for (const field of includes) {
    if (field in item) copy[field] = item[field];
  }
  return copy;
}

class SupabaseQuery {
  constructor(model, { filter = {}, singleId = null } = {}) {
    this.model = model;
    this.filter = filter || {};
    this.singleId = singleId;
    this.sortSpec = null;
    this.skipCount = 0;
    this.limitCount = null;
    this.projection = null;
    this.returnLean = false;
  }

  select(projection) {
    this.projection = projection;
    return this;
  }

  sort(sortSpec) {
    this.sortSpec = sortSpec;
    return this;
  }

  skip(count) {
    this.skipCount = Number(count) || 0;
    return this;
  }

  limit(count) {
    this.limitCount = Number(count);
    return this;
  }

  lean() {
    this.returnLean = true;
    return this;
  }

  async exec() {
    const rows = await this.model._fetchRows();
    let items = rows.map((row) => rowToPlain(row));
    if (this.singleId) {
      const found = items.find((item) => String(item._id) === String(this.singleId));
      if (!found) return null;
      const projected = applyProjection(found, this.projection);
      return this.returnLean ? projected : new SupabaseDocument(this.model, projected);
    }

    items = items.filter((item) => matchesFilter(item, this.filter));
    if (this.sortSpec) {
      const [[key, direction]] = Object.entries(this.sortSpec);
      items.sort((a, b) => {
        const left = a[key] instanceof Date ? a[key].getTime() : a[key];
        const right = b[key] instanceof Date ? b[key].getTime() : b[key];
        if (left === right) return 0;
        return (left > right ? 1 : -1) * (direction < 0 ? -1 : 1);
      });
    }
    if (this.skipCount) items = items.slice(this.skipCount);
    if (this.limitCount != null) items = items.slice(0, this.limitCount);
    items = items.map((item) => applyProjection(item, this.projection));
    return this.returnLean ? items : items.map((item) => new SupabaseDocument(this.model, item));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

export class SupabaseModel {
  constructor(table, mapDocumentToRow) {
    this.table = table;
    this.mapDocumentToRow = mapDocumentToRow;
  }

  find(filter = {}) {
    return new SupabaseQuery(this, { filter });
  }

  findOne(filter = {}) {
    const query = new SupabaseQuery(this, { filter }).limit(1);
    const originalExec = query.exec.bind(query);
    query.exec = async () => {
      const rows = await originalExec();
      return Array.isArray(rows) ? rows[0] || null : rows;
    };
    return query;
  }

  findById(id) {
    return new SupabaseQuery(this, { singleId: id });
  }

  async findByIdAndUpdate(id, update) {
    const doc = await this.findById(id);
    if (!doc) return null;
    Object.assign(doc, update);
    return doc.save();
  }

  async create(data) {
    const doc = new SupabaseDocument(this, {
      ...data,
      _id: data._id || data.id || new ObjectId().toHexString(),
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    });
    const { error } = await getSupabase().from(this.table).insert(this.mapDocumentToRow(doc));
    if (error) {
      const wrapped = new Error(error.message);
      if (error.code === '23505') wrapped.code = 11000;
      throw wrapped;
    }
    return doc;
  }

  async countDocuments(filter = {}) {
    const rows = await this._fetchRows();
    return rows.map((row) => rowToPlain(row)).filter((item) => matchesFilter(item, filter)).length;
  }

  async aggregate(pipeline = []) {
    const matchStage = pipeline.find((stage) => stage.$match)?.$match || {};
    const groupStage = pipeline.find((stage) => stage.$group)?.$group;
    const rows = await this._fetchRows();
    const items = rows.map((row) => rowToPlain(row)).filter((item) => matchesFilter(item, matchStage));
    if (!groupStage) return items;
    const result = new Map();
    for (const item of items) {
      const groupKey = String(item[String(groupStage._id).replace('$', '')]);
      const current = result.get(groupKey) || { _id: groupKey };
      for (const [key, expression] of Object.entries(groupStage)) {
        if (key === '_id') continue;
        if (expression.$sum === 1) current[key] = (current[key] || 0) + 1;
        if (typeof expression.$sum === 'string') {
          current[key] = (current[key] || 0) + Number(item[expression.$sum.replace('$', '')] || 0);
        }
      }
      result.set(groupKey, current);
    }
    return [...result.values()];
  }

  async _fetchRows() {
    const { data, error } = await getSupabase().from(this.table).select('*');
    if (error) throw error;
    return data || [];
  }

  async _upsertDocument(doc) {
    const { error } = await getSupabase().from(this.table).upsert(this.mapDocumentToRow(doc), { onConflict: 'id' });
    if (error) throw error;
  }
}

export function baseRow(doc) {
  const plain = docToPlain(doc);
  return {
    id: String(plain._id || plain.id),
    created_at: normalizeValue(plain.createdAt) || new Date().toISOString(),
    updated_at: normalizeValue(plain.updatedAt) || new Date().toISOString(),
    raw: JSON.parse(JSON.stringify(plain)),
  };
}

export function valueOrNull(value) {
  return value === undefined || value === '' ? null : normalizeValue(value);
}
