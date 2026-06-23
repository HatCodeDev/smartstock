# Delta Specification: Reports Page - Exhibition Return Rate

## MODIFIED Requirements

### Requirement 7: Exhibition Return Rate Metric Naming & Dynamic Evaluation
The reports page MUST display the return rate metric using the updated terminology "Tasa de Retorno de Exhibición" (Exhibition Return Rate) in Spanish. The status color coding for this metric MUST be evaluated dynamically based on the threshold returned from the API (`umbral_retorno_critico`, which defaults to 80.0%), rather than a hardcoded 20% value. A critical status alert MUST be triggered ONLY when the return rate is strictly greater than the critical threshold (representing low sales of displayed items).

#### Scenario 7.1: Exhibition Return Rate Terminology
- **GIVEN** the reports page is loaded
- **WHEN** rendering the return rate metric label or column headers
- **THEN** the text MUST read "Tasa de Retorno de Exhibición" in Spanish
- **AND** the description MUST clarify it represents unsold merchandise returning to the warehouse.

#### Scenario 7.2: Dynamic Threshold Evaluation and Color Coding
- **GIVEN** the reports page loads configuration data from the API
- **AND** the API returns a `umbral_retorno_critico` value (e.g., 80%)
- **WHEN** displaying the return rate status for a product
- **THEN** the status MUST be marked as critical (e.g., red/alert) ONLY if the product's return rate is strictly GREATER THAN `umbral_retorno_critico`
- **AND** the status MUST be marked as normal/safe (e.g., green/neutral) if the return rate is less than or equal to `umbral_retorno_critico`.
