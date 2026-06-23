# Delta Specification: Product Detail Modal - Exhibition Return Rate

## MODIFIED Requirements

### Requirement 1: Product Detail Modal Exhibition Return Rate Widget
The product detail modal MUST display the return rate metric utilizing the corrected terminology "Tasa de Retorno de Exhibición" (Exhibition Return Rate) and its associated description. The visual status indicators and alerts MUST be dynamically evaluated against the critical threshold (`umbral_retorno_critico`, default 80%) retrieved from the configuration API, flagging critical status only when the rate exceeds this threshold.

#### Scenario 1.1: Widget Terminology and Description
- **GIVEN** a product detail modal is opened for a specific product
- **WHEN** rendering the return rate section
- **THEN** the section label MUST read "Tasa de Retorno de Exhibición"
- **AND** the description MUST read "Porcentaje de stock en exhibición que retornó a bodega sin venderse."

#### Scenario 1.2: Dynamic Alert Triggering in Modal
- **GIVEN** the configuration API returns a `umbral_retorno_critico` of 80%
- **WHEN** the product's exhibition return rate is 85%
- **THEN** the modal MUST render a critical status indicator (e.g., red/alert)
- **WHEN** the product's exhibition return rate is 75%
- **THEN** the modal MUST NOT render a critical status indicator.
