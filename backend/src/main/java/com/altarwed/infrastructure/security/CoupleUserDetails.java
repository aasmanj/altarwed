package com.altarwed.infrastructure.security;

import com.altarwed.domain.model.Couple;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class CoupleUserDetails implements UserDetails {

    private final Couple couple;

    public CoupleUserDetails(Couple couple) {
        this.couple = couple;
    }

    public Couple getCouple() {
        return couple;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_COUPLE"));
    }

    @Override
    public String getPassword() {
        return couple.passwordHash();
    }

    @Override
    public String getUsername() {
        return couple.email();
    }

    @Override
    public boolean isEnabled() {
        return couple.isActive();
    }
}
