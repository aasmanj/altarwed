package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.model.BlogPost;
import com.altarwed.domain.port.BlogPostRepository;
import com.altarwed.infrastructure.persistence.entity.BlogPostEntity;
import com.altarwed.infrastructure.persistence.repository.BlogPostJpaRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class BlogPostRepositoryAdapter implements BlogPostRepository {

    private final BlogPostJpaRepository jpa;

    public BlogPostRepositoryAdapter(BlogPostJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public List<BlogPost> findAllPublished() {
        return jpa.findAllByIsPublishedTrueOrderByPublishedAtDesc()
                  .stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<BlogPost> findBySlug(String slug) {
        return jpa.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public BlogPost save(BlogPost post) {
        return toDomain(jpa.save(toEntity(post)));
    }

    @Override
    public void deleteById(UUID id) {
        jpa.deleteById(id);
    }

    private BlogPost toDomain(BlogPostEntity e) {
        return new BlogPost(
                e.getId(), e.getSlug(), e.getTitle(), e.getExcerpt(), e.getContent(),
                e.getAuthor(), e.getPublishedAt(), e.getSeoTitle(), e.getSeoDesc(),
                e.getTags(), e.getCoverImage(), e.getIsPublished(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    private BlogPostEntity toEntity(BlogPost p) {
        return BlogPostEntity.builder()
                .id(p.id())
                .slug(p.slug())
                .title(p.title())
                .excerpt(p.excerpt())
                .content(p.content())
                .author(p.author())
                .publishedAt(p.publishedAt())
                .seoTitle(p.seoTitle())
                .seoDesc(p.seoDesc())
                .tags(p.tags())
                .coverImage(p.coverImage())
                .isPublished(p.isPublished())
                .createdAt(p.createdAt())
                .updatedAt(p.updatedAt())
                .build();
    }
}
