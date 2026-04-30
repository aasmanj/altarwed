package com.altarwed.infrastructure.security;

import com.altarwed.domain.port.CoupleRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CoupleUserDetailsService implements UserDetailsService {

    private final CoupleRepository coupleRepository;

    public CoupleUserDetailsService(CoupleRepository coupleRepository) {
        this.coupleRepository = coupleRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return coupleRepository.findByEmail(email)
                .map(CoupleUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("No account found for: " + email));
    }
}
