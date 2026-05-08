import { BaseException } from './BaseException.js';

/** 404 - Resource not found */
export class ResourceNotFoundException extends BaseException {
  constructor(resource, id) {
    super(404, 'RESOURCE_NOT_FOUND', `${resource} with id '${id}' was not found`);
  }
}
