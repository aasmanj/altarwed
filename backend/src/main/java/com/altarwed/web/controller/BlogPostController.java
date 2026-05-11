package com.altarwed.web.controller;

import com.altarwed.application.dto.BlogPostResponse;
import com.altarwed.application.service.BlogPostService;
import com.altarwed.domain.model.BlogPost;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/blog")
public class BlogPostController {

    private final BlogPostService service;

    public BlogPostController(BlogPostService service) {
        this.service = service;
    }

    @GetMapping("/posts")
    public ResponseEntity<List<BlogPostResponse>> listPublished() {
        return ResponseEntity.ok(service.listPublished().stream().map(this::toResponse).toList());
    }

    @GetMapping("/posts/{slug}")
    public ResponseEntity<BlogPostResponse> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(toResponse(service.getBySlug(slug)));
    }

    private BlogPostResponse toResponse(BlogPost p) {
        return new BlogPostResponse(
                p.id(), p.slug(), p.title(), p.excerpt(), p.content(),
                p.author(), p.publishedAt(), p.seoTitle(), p.seoDesc(),
                p.tags(), p.coverImage(), p.isPublished(), p.updatedAt()
        );
    }
}
