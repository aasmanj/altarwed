package com.altarwed.application.service;

import com.altarwed.domain.exception.BlogPostNotFoundException;
import com.altarwed.domain.model.BlogPost;
import com.altarwed.domain.port.BlogPostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BlogPostService {

    private final BlogPostRepository repository;

    public BlogPostService(BlogPostRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<BlogPost> listPublished() {
        return repository.findAllPublished();
    }

    @Transactional(readOnly = true)
    public BlogPost getBySlug(String slug) {
        return repository.findBySlug(slug)
                .filter(p -> Boolean.TRUE.equals(p.isPublished()))
                .orElseThrow(() -> new BlogPostNotFoundException(slug));
    }
}
