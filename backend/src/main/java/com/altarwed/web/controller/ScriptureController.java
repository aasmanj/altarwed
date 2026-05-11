package com.altarwed.web.controller;

import com.altarwed.application.dto.ScriptureFeaturedResponse;
import com.altarwed.application.dto.ScriptureVerseResponse;
import com.altarwed.application.service.ScriptureService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/scripture")
public class ScriptureController {

    private final ScriptureService service;

    public ScriptureController(ScriptureService service) {
        this.service = service;
    }

    @GetMapping("/featured")
    public ResponseEntity<ScriptureFeaturedResponse> featured() {
        return ResponseEntity.ok(service.getFeatured());
    }

    @GetMapping("/search")
    public ResponseEntity<ScriptureVerseResponse> search(@RequestParam String q) {
        return ResponseEntity.ok(service.search(q));
    }
}
