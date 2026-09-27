-- Extend the phase 1 finite-time policy to the phase 2 audit columns.
ALTER TABLE coordinate_candidates ADD CONSTRAINT reviewed_at_finite CHECK(reviewed_at IS NULL OR isfinite(reviewed_at));
ALTER TABLE place_coordinates ADD CONSTRAINT status_changed_at_finite CHECK(isfinite(status_changed_at));
ALTER TABLE place_coordinates ADD CONSTRAINT revoked_at_finite CHECK(revoked_at IS NULL OR isfinite(revoked_at));
ALTER TABLE coordinate_candidates ADD CONSTRAINT candidate_accuracy_finite CHECK(accuracy_meters IS NULL OR accuracy_meters < 'Infinity'::numeric);
ALTER TABLE place_coordinates ADD CONSTRAINT formal_accuracy_finite CHECK(accuracy_meters IS NULL OR accuracy_meters < 'Infinity'::numeric);
