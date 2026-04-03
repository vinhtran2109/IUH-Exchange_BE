package edu.iuh.exchange.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Base exception cho toàn bộ microservices.
 * Mọi business exception đều extend từ class này.
 */
public class BaseException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public BaseException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
