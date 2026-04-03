package edu.iuh.exchange.common.exception;

import org.springframework.http.HttpStatus;

/** 404 - Resource not found */
public class ResourceNotFoundException extends BaseException {
    public ResourceNotFoundException(String resource, String id) {
        super(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND",
                String.format("%s with id '%s' was not found", resource, id));
    }
}
