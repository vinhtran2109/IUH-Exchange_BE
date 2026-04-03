package edu.iuh.exchange.common.exception;

import org.springframework.http.HttpStatus;

/** 400 - Bad Request / Validation Error */
public class BadRequestException extends BaseException {
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, "BAD_REQUEST", message);
    }
}
