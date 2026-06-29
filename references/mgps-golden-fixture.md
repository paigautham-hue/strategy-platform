# MGPS Golden Fixture — anchor-customer demo/seed data

> **Provenance:** salvaged from the StrategyForge prototype (`mgps_company_data.md`)
> during the 2026-06-29 prototype-consolidation pass. This is a real financial
> extraction for Manipal Global Print Solutions (MGPS) — the anchor customer
> modelled across the strategy prototypes — kept here as the canonical **golden
> fixture**: a single, realistic company + 5-year projection for demos, seed
> data, and end-to-end test scenarios (e.g. feeding the Monte Carlo engine or the
> onboarding wizard).
>
> **Usage notes:**
> - Treat this file as the source of truth for the demo MGPS company; do not
>   create a second MGPS record. When seeding, de-duplicate against any existing
>   MGPS company/project row.
> - Figures are an FY2024-25 snapshot with FY25-29 projections; they are a fixture,
>   not live data. Do not present them as current without re-verification.
> - All amounts are in ₹ Crore (use `server/services/currency.ts` for USD display).

---

## Basic Company Information

**Company Name:** Manipal Global Print Solutions (MGPS)
**Parent Company:** Manipal Technologies Limited
**Founded:** 1941 (as part of Manipal Technologies Limited)
**Industry:** Printing & Publishing
**Sub-Industry:** Commercial Printing Services
**Headquarters:** Manipal, Karnataka, India
**Estimated Size:** 201-500 employees

## Company Description
Manipal Global Print Solutions is a unit of Manipal Technologies Limited (established 1941), specializing in innovative print solutions for the publishing industry — high-quality print manufacturing that helps customers connect with their audiences.

## Vision Statement
"To be the world's leading provider of innovative print solutions that empower our customers to connect with their audiences in meaningful ways"

## Financial Data (FY 2024-25)

### Revenue & Profitability
- **Revenue Budget:** ₹620.00 Cr
- **Revenue Outlook:** ₹568.78 Cr
- **Product Margin:** 26.2%
- **EBITDA:** ₹37.97 Cr (6.7%)
- **PBT:** ₹14.20 Cr
- **Depreciation:** ₹11.16 Cr
- **Interest:** ₹12.61 Cr

### Capital Metrics
- **ROCE (Return on Capital Employed):** 26.81%
- **Average Invested Capital / Capital Employed:** ₹126.57 Cr
- **Return on Capital Employed:** 21.2%
- **Average Working Capital:** ₹44.05 Cr
- **Return on Working Capital:** 60.9%

### Key Achievements FY 2024-25
- Achieved ₹100 Cr Exports for the 1st time in company history
- Successfully onboarded 10+ strategic customers
- Improved output and throughput by optimizing job mix
- Met target ROCE

## 3-Year Financial Projections

### Revenue Projections (in ₹ Cr)
| Year | Revenue | EBITDA % | ROCE % |
|------|---------|----------|--------|
| FY 2024-25 | 569 | 6.7% | 23.3% |
| FY 2025-26 | 675 | 9.3% | 19.0% |
| FY 2026-27 | 790 | 10.8% | 23.3% |
| FY 2027-28 | 950 | 11.4% | 28.3% |
| FY 2028-29 | 1,120 | 11.6% | 30.6% |

## Business Segments

### 1. Export Segments

#### Education Books (Textbooks)
- **FY-25 Revenue:** ₹65.0 Cr → FY-26 ₹90.0 Cr → FY-27 ₹125.0 Cr → FY-28 ₹165.0 Cr
- **Market:** K-12 textbooks, printed and digital
- **Target Geography:** Europe, Asia-Pacific
- **Key Customers:** Large MNC publishers

#### Children's Books (4-Color)
- **FY-25 Revenue:** ₹28.0 Cr → FY-26 ₹55.0 Cr → FY-27 ₹75.0 Cr → FY-28 ₹110.0 Cr
- **Focus:** Picture Books, Graphics, Comics, Encyclopaedias, Religious Trade
- **Target Markets:** US, UK, Europe, Asia-Pacific (Singapore, Malaysia, Vietnam)

#### Bible Books
- **FY-25 Revenue:** ₹5.0 Cr → FY-26 ₹30.0 Cr → FY-27 ₹75.0 Cr → FY-28 ₹110.0 Cr
- **Market Position:** Strong, consecutive gains exceeding pre-pandemic levels
- **Major Focus:** USA market; key customers are USA market leaders

### 2. Domestic Segments

#### Education & Trade Books
- **FY-25 Revenue:** ₹150.0 Cr (₹100 Cr Education + ₹50 Cr Trade) → FY-26 ₹165.0 Cr → FY-27 ₹180.0 Cr → FY-28 ₹200.0 Cr
- **Market:** India's third-largest book market worldwide
- **Focus:** School segment (70%+ of market), Higher Education, Trade books

#### Digital Print
- **FY-25 Revenue:** ₹35.0 Cr → FY-26 ₹45.0 Cr → FY-27 ₹50.0 Cr → FY-28 ₹50.0 Cr
- **Market Size:** ₹2,000-2,500 Cr in India
- **Product Mix:** Academic Books (70%), Trade Books (20%), Self Publishing (10%)
- **Quantity:** 600-800 million books/items printed annually

#### Print Service-Outsourcing
- Listed as a focus segment

## Strategic Initiatives & Challenges

### Key Focus Areas (Next 3 Years)
1. **ROCE Improvement:** Target 19% for FY25-26 and 23% for FY26-27
2. **EBITDA Growth:** Minimum 9.3% in FY25-26, 10.8% in FY26-27
3. **Export Revenue:** Target ₹200 Cr from Export segment in FY25-26
4. **Product & Geography Mix:** Achieve segment-wise revenue to optimize infrastructure
5. **Factory Throughput:** Improve machine efficiencies and throughput
6. **Inventory & Receivables Control:** Improve working capital management

### Challenges & Lessons Learned
1. **Dispatch & Delivery Timelines:** Critical for export; clear customer communication essential
2. **Customer Updates:** Hired KAS team for dedicated customer engagement
3. **Capex Delays:** New-machine delays impacted revenue; future orders placed 4-6 months in advance
4. **Imported Paper Mills:** Dependency on two mills caused a 4-month shutdown impact; onboarding additional mills
5. **Quality & Fulfillment:** Appointed Quality Team Head, increased quality checks

## Infrastructure & Operations

### Facilities
- **Manipal Facility:** Main production facility
- **Noida Facility:** Ready for full-fledged digital print production from next financial year — serves North and East, reduces TAT and logistics costs

### Technology Investments
- 4-color sheetfed infrastructure
- Mono color sheetfed machines for domestic education
- Special operations: gilding, edge colouring, sewing, printing
- Digital book print line for runs under 1400 (B-size books)
