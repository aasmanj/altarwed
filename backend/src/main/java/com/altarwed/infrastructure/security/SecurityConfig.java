package com.altarwed.infrastructure.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final CoupleUserDetailsService userDetailsService;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitingFilter rateLimitingFilter;

    @Value("${altarwed.cors.allowed-origins}")
    private String allowedOrigins;

    public SecurityConfig(
            CoupleUserDetailsService userDetailsService,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            RateLimitingFilter rateLimitingFilter
    ) {
        this.userDetailsService = userDetailsService;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitingFilter = rateLimitingFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/**",
                                "/api/v1/couples/register",
                                "/api/v1/vendors/register"
                        ).permitAll()
                        // Spring Security 7 path matching: "/**" does not match the bare base
                        // path (e.g. "/vendors/**" does not match "/vendors"). Any public endpoint
                        // that can be called without a path variable needs both the exact path and
                        // the wildcard listed explicitly.
                        // /me routes require ROLE_VENDOR; the narrowed public matchers below never
                        // match /me, but this stays first as defence in depth.
                        .requestMatchers("/api/v1/vendors/me", "/api/v1/vendors/me/**").hasAuthority("ROLE_VENDOR")
                        // Only the specific public vendor GETs are permitAll (issue #554). The old
                        // "/api/v1/vendors/**" wildcard made EVERY current and future vendor GET public,
                        // so any later GET /vendors/{id}/... that trusted the path id would be silently
                        // unauthenticated. Enumerating the real public reads lets anyRequest().authenticated()
                        // guard everything else by default. "*" is a single path segment, so
                        // "/api/v1/vendors/*" covers /{id} and /founding-spots but NOT /me/... (two-plus
                        // segments), and the portfolio-photos read needs its own two-segment matcher.
                        // RESIDUAL FOOTGUN: any FUTURE single-segment vendor GET (e.g. a hypothetical
                        // GET /api/v1/vendors/pending-payouts) is auto-public under "/vendors/*". Before
                        // adding one, either accept that it is public or give it an explicit
                        // authenticated matcher ABOVE these permitAll lines (first match wins).
                        .requestMatchers(HttpMethod.GET, "/api/v1/vendors").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/vendors/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/vendors/*/portfolio-photos").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/denominations", "/api/v1/denominations/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-websites/slug/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-websites/published").permitAll()
                        // Owner-only editor preview (renders drafts); slug is the capability, not a
                        // session -- see WeddingWebsiteService.getBySlugForPreview (#91).
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-websites/preview/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-page-blocks/preview/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-photos/website/preview/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/guests/rsvp/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/guests/rsvp").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-party/website/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-photos/website/slug/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-page-blocks/slug/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/scripture/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-websites/*/hotels").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/wedding-websites/search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/blog/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/inquiries").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/integrations/google-sheets/callback").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/unsubscribe").permitAll()
                        // Stripe webhook: Stripe-signed, no JWT
                        .requestMatchers(HttpMethod.POST, "/api/v1/stripe/webhook").permitAll()
                        // Resend delivery webhook: Svix-signed, no JWT (verified in ResendWebhookVerifier)
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/resend").permitAll()
                        // Lob delivery webhook: Lob-signed, no JWT (verified in LobWebhookVerifier)
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/lob").permitAll()
                        // OpenAPI / Swagger, dev convenience
                        .requestMatchers("/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // Actuator health
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        var provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        // X-Request-Id is set on every response by RequestIdFilter so users can
        // quote it in support. Browsers block fetch().headers.get() from reading
        // response headers cross-origin unless they are in Access-Control-Expose-Headers.
        config.setExposedHeaders(List.of("X-Request-Id"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/swagger-ui/**", config);
        source.registerCorsConfiguration("/api-docs/**", config);
        return source;
    }
}
