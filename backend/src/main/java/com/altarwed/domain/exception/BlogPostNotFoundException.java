package com.altarwed.domain.exception;

public class BlogPostNotFoundException extends RuntimeException {
    public BlogPostNotFoundException(String slug) {
        super("Blog post not found: " + slug);
    }
}
