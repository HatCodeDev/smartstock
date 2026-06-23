# Delta Specification: None

No product-level specification changes are required for the `correct-return-rates-and-kmeans-logic` change.

## Context
This change is a backend-only refactor to the K-Means clustering algorithm query in `backend/app/services/advanced_report_service.py`. It aligns the implementation with existing core business rules (evaluating metrics at the cycle level and only counting active net sales cycles) without changing the functional or product requirements of the reports page.

## ADDED Requirements
None

## MODIFIED Requirements
None

## REMOVED Requirements
None

## RENAMED Requirements
None
