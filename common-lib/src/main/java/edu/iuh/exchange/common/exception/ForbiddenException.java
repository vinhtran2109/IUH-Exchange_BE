package edu.iuh.exchange.common.exception;

import org.springframework.http.HttpStatus;

/** 403 - Forbidden: không có quyền truy cập */
public class ForbiddenException extends BaseException {
    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
}
