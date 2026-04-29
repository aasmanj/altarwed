package com.altarwed.domain.port;

import com.altarwed.domain.model.Vendor;
import com.altarwed.domain.model.VendorCategory;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorRepository {

    Vendor save(Vendor vendor);

    Optional<Vendor> findById(UUID id);

    Optional<Vendor> findByEmail(String email);

    boolean existsByEmail(String email);

    List<Vendor> findByCity(String city);

    List<Vendor> findByCityAndCategory(String city, VendorCategory category);

    List<Vendor> findByCategory(VendorCategory category);

    List<Vendor> findAllActive();

    void deleteById(UUID id);
}
