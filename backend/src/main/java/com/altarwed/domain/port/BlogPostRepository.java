package com.altarwed.domain.port;

import com.altarwed.domain.model.BlogPost;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlogPostRepository {
    List<BlogPost> findAllPublished();
    Optional<BlogPost> findBySlug(String slug);
    BlogPost save(BlogPost post);
    void deleteById(UUID id);
}
