"""Generate all prompt template .md files for the IPO Draft Engine."""
import os

PROMPTS_DIR = os.path.join(os.path.dirname(__file__))

BASE = """You are an expert IPO drafting specialist with deep knowledge of SEBI (Securities and Exchange Board of India) regulations for SME IPOs on NSE Emerge and BSE SME platforms.

Your task is to generate the **{section_name}** section for a Draft Red Herring Prospectus (DRHP).

## Instructions
- Use ONLY the structured data provided below. Do NOT invent facts, figures, or names.
- If a required field is missing, write [Information Required: <field description>] as a placeholder.
- Follow SEBI (ICDR) Regulations, 2018 formatting conventions.
- Output in clean Markdown suitable for document rendering.
- Do NOT include the section heading — write only the body content.
- Use formal, professional language consistent with SEBI regulatory filings.
- Use Indian numbering format (Lakhs, Crores) for financial figures.

## Available Company Data
```
{{knowledge_data}}
```

## Missing Fields
The following required fields could not be found in the knowledge base:
```
{{missing_fields}}
```

## Output Requirements
{output_requirements}

---
**Important Notice:** This content is AI-generated as a first draft. All figures, names, dates, and disclosures must be verified and approved by qualified Merchant Bankers and Legal Advisors before regulatory filing.
"""

SECTIONS = {
    "definitions-abbreviations": {
        "section_name": "Definitions & Abbreviations",
        "output_requirements": """Generate an alphabetically ordered table of definitions covering:
1. Company and issue-related terms (Issuer, Promoter, Offer, DRHP, etc.)
2. Regulatory and legal abbreviations (SEBI, ICDR, RBI, NSE, BSE, etc.)
3. Financial terms (PAT, EBITDA, EPS, ROE, NAV, etc.)
4. Industry-specific terms relevant to the company's sector
Format as a two-column Markdown table: Term | Definition"""
    },
    "issue-summary": {
        "section_name": "Issue Summary",
        "output_requirements": """Generate a structured summary table containing:
1. Issue size breakdown (Fresh Issue + OFS if applicable)
2. Price band / issue price and face value
3. Lot size and minimum application amount
4. Issue opening and closing dates
5. Pre and post-issue promoter holding (%)
6. Exchange and market segment
7. Objects of the issue (brief)
Format as structured Markdown tables."""
    },
    "risk-factors": {
        "section_name": "Risk Factors",
        "output_requirements": """Generate a comprehensive risk factors disclosure covering:
1. Internal Risks: Business-specific, operational, management, and technology risks
2. Financial Risks: Revenue concentration, debt, liquidity, working capital risks
3. External Risks: Market, regulatory, macroeconomic, and industry risks
4. Legal Risks: Pending litigation, IP, compliance risks
Each risk should include: (a) description of the risk, (b) potential impact on the business.
Number each risk factor. Use formal disclosure language."""
    },
    "industry-overview": {
        "section_name": "Industry Overview",
        "output_requirements": """Generate an industry overview covering:
1. Industry definition and scope
2. Market size and growth rate (TAM, SAM)
3. Key industry trends and growth drivers
4. Competitive landscape and key players
5. Regulatory framework governing the industry
6. Challenges and opportunities
7. Outlook for next 3-5 years
Use available industry data and supplement with general sector knowledge where noted."""
    },
    "company-overview": {
        "section_name": "Company Overview",
        "output_requirements": """Generate a company overview covering:
1. Company name, CIN, date and place of incorporation
2. Registered office and corporate office addresses
3. Nature of business and primary operations
4. Corporate structure (subsidiaries, associates if any)
5. Vision and mission (if available)
6. Key achievements and certifications
Present as flowing prose with structured sub-sections."""
    },
    "business-overview": {
        "section_name": "Business Overview",
        "output_requirements": """Generate a detailed business overview covering:
1. Business model and revenue streams
2. Products and services portfolio
3. Customer segments and key customers
4. Geographic presence and markets served
5. Operational capabilities and infrastructure
6. Technology and innovation
7. Quality certifications and standards
Present as detailed prose with organized sub-sections."""
    },
    "competitive-strengths": {
        "section_name": "Competitive Strengths",
        "output_requirements": """Generate 6-10 key competitive strengths, each with:
1. A clear, bold heading summarizing the strength
2. 2-3 paragraphs explaining the strength with supporting data
Format each strength as a numbered subsection with supporting evidence from the knowledge data."""
    },
    "business-strategy": {
        "section_name": "Business Strategy",
        "output_requirements": """Generate strategic initiatives covering:
1. Overall growth strategy and vision
2. Product/service expansion plans
3. Geographic expansion plans
4. Technology and digital transformation plans
5. Capacity expansion and capex plans
6. Partnerships and inorganic growth plans
7. How IPO proceeds will fund the strategy
Present as numbered strategic pillars with supporting detail."""
    },
    "company-history": {
        "section_name": "Company History",
        "output_requirements": """Generate a chronological corporate history covering:
1. Year of incorporation and founding vision
2. Key milestones by year (product launches, expansions, certifications, awards)
3. Major corporate events (acquisitions, restructuring, equity rounds)
4. Evolution of the business model
Present as a timeline table and then a narrative section."""
    },
    "products-services": {
        "section_name": "Products & Services",
        "output_requirements": """Generate detailed descriptions of:
1. Each product/product category with specifications
2. Each service offering
3. Revenue contribution by product/service (if available)
4. Product pipeline and upcoming launches
5. Pricing structure (if available)
6. Key differentiators for each product/service
Format as organized subsections per product/service category."""
    },
    "manufacturing-operations": {
        "section_name": "Manufacturing & Operations",
        "output_requirements": """Generate manufacturing and operations details covering:
1. Manufacturing facility locations and ownership (owned/leased)
2. Total installed capacity and current utilization rates
3. Manufacturing process overview
4. Quality control and certifications (ISO, BIS, etc.)
5. Raw material sourcing and key suppliers
6. Supply chain and logistics
7. Planned capacity expansions
Present with facility-wise breakdown where applicable."""
    },
    "properties-facilities": {
        "section_name": "Properties & Facilities",
        "output_requirements": """Generate a properties disclosure covering:
1. Owned properties (address, area, usage, encumbrances)
2. Leased properties (address, area, lease term, lessor)
3. Other facilities (warehouses, distribution centers)
Format as structured tables with property details."""
    },
    "regulatory-environment": {
        "section_name": "Regulatory Environment",
        "output_requirements": """Generate a regulatory overview covering:
1. Primary regulatory bodies governing the business
2. Key laws and regulations applicable to the business
3. Licenses and approvals required and obtained
4. Recent regulatory changes and their impact
5. Compliance status
6. Industry-specific regulatory requirements
Present as organized sub-sections by regulatory body/law."""
    },
    "mda": {
        "section_name": "Management Discussion & Analysis",
        "output_requirements": """Generate an MDA covering:
1. Industry Overview and Outlook (brief)
2. Business Performance Review (year-over-year analysis)
3. Revenue Analysis: segment-wise and geography-wise breakdown
4. Profitability Analysis: gross margin, EBITDA, PAT trends
5. Balance Sheet Analysis: assets, liabilities, net worth
6. Liquidity and Cash Flow Analysis
7. Key Financial Ratios and their interpretation
8. Segment Reporting
9. Outlook and Future Plans
10. Key Risks and Concerns
Use actual figures from the financial data provided. Show year-over-year changes."""
    },
    "directors-kmp": {
        "section_name": "Directors & Key Management Personnel",
        "output_requirements": """Generate profiles for each Director and KMP covering:
1. Full name, designation, DIN (for directors)
2. Age, qualification, and experience summary
3. Date of appointment
4. Directorship in other companies
5. Terms and conditions of appointment
6. Compensation and benefits
7. Board committee memberships
Format each person as a structured sub-section."""
    },
    "promoters": {
        "section_name": "Promoters",
        "output_requirements": """Generate promoter disclosures covering:
1. Individual promoter profiles (name, age, background, PAN, Aadhar reference)
2. Promoter entities and group companies
3. Pre-issue and post-issue shareholding
4. Lock-in period details
5. Promoter's contribution to the issue
6. Pledged or encumbered shares (if any)
7. Promoter's experience in the industry
Present individual and entity promoters separately."""
    },
    "shareholding-pattern": {
        "section_name": "Shareholding Pattern",
        "output_requirements": """Generate shareholding disclosures covering:
1. Pre-issue shareholding table (category-wise)
2. Post-issue shareholding table (category-wise)
3. Top 10 shareholders pre-issue
4. Details of shareholders holding > 1% pre-issue
5. Lock-in details for promoter shares
6. Employee stock options outstanding
Format as detailed Markdown tables."""
    },
    "capital-structure": {
        "section_name": "Capital Structure",
        "output_requirements": """Generate capital structure details covering:
1. Authorized share capital
2. Paid-up share capital (before and after issue)
3. Share capital history (all allotments since incorporation)
4. Employee stock option plans (if any)
5. Convertible securities outstanding (if any)
6. Post-issue capital table
Format as structured tables with dates and amounts."""
    },
    "financial-information": {
        "section_name": "Financial Information",
        "output_requirements": """Generate financial summary covering:
1. Summary of Audited Financial Statements for last 3 financial years
2. Key P&L items (Revenue, EBITDA, PAT)
3. Key Balance Sheet items (Total Assets, Net Worth, Debt)
4. Cash Flow summary (Operating, Investing, Financing)
5. Key Financial Ratios table (EPS, ROE, ROCE, D/E, Current Ratio, etc.)
6. Auditor's qualifications/remarks (if any)
7. Restated financial summary
Note: Present figures in INR Lakhs/Crores. Include year-on-year growth %."""
    },
    "objects-of-issue": {
        "section_name": "Objects of the Issue",
        "output_requirements": """Generate objects of the issue covering:
1. Total funds to be raised (fresh issue component)
2. Purpose-wise utilization table with amounts
3. Detailed explanation of each object (capex, working capital, debt repayment, general corporate purposes)
4. Implementation timeline
5. Appraisal status (self-appraised / appraised by bank)
6. Means of finance (IPO proceeds + internal accruals)
Format includes a summary table followed by detailed narrative per object."""
    },
    "issue-details": {
        "section_name": "Issue Details",
        "output_requirements": """Generate issue details covering:
1. Issue structure (book-built / fixed price)
2. Allocation breakdown (QIB, Non-Institutional, Retail)
3. Issue timeline (opening, closing, listing date)
4. Price band and offer price
5. Minimum application (1 lot) and maximum (retail)
6. Bid/Application process
7. Payment schedule and refund process
8. Listing details (exchange, symbol)
Format as structured tables and numbered process steps."""
    },
    "dividend-policy": {
        "section_name": "Dividend Policy",
        "output_requirements": """Generate dividend policy disclosure covering:
1. Statement of the company's dividend policy
2. Historical dividend payments (last 5 years table)
3. Factors considered for dividend declaration
4. Dividend payout ratio trends
5. Future dividend outlook
If no dividends have been paid, state clearly and explain the policy going forward."""
    },
    "related-party-transactions": {
        "section_name": "Related Party Transactions",
        "output_requirements": """Generate RPT disclosures covering:
1. List of related parties (as per Ind AS 24)
2. Nature of relationship for each related party
3. Transaction-wise disclosure table (party, nature, amount, terms)
4. Outstanding balances at year-end
5. Key terms and pricing policy (arm's length confirmation)
6. Board approval status
Format as structured tables per financial year."""
    },
    "outstanding-litigation": {
        "section_name": "Outstanding Litigation",
        "output_requirements": """Generate litigation disclosures covering:
1. Pending criminal proceedings
2. Pending civil proceedings
3. Tax and regulatory disputes
4. SEBI/ROC/RBI related proceedings
5. Cases against directors and promoters
6. Material and immaterial threshold disclosure
7. Contingent liabilities
For each case: parties involved, forum, nature, amount involved, status.
If no material litigation exists, include the standard nil disclosure statement."""
    },
    "material-contracts": {
        "section_name": "Material Contracts",
        "output_requirements": """Generate material contracts disclosure covering:
1. Contracts not entered into in the ordinary course of business
2. Key commercial agreements (partnership, technology, distribution)
3. Joint venture agreements
4. Loan agreements and credit facilities
5. Any agreement with related parties
For each contract: parties, date, brief description, key terms."""
    },
    "government-approvals": {
        "section_name": "Government Approvals",
        "output_requirements": """Generate approvals disclosure covering:
1. Approvals obtained and their validity
2. Pending approvals required for the issue
3. Approvals required for expansion plans
4. Licenses and certificates with expiry dates
Format as a table: Approval/License | Issuing Authority | Date | Validity | Status."""
    },
    "statutory-information": {
        "section_name": "Statutory Information",
        "output_requirements": """Generate statutory information covering:
1. Company registration details (CIN, RoC)
2. Statutory auditor details and peer review certificate
3. Compliance officer details
4. Investor grievance mechanism
5. Share transfer agent details
6. Stock exchange listing details
7. Face value, ISIN, trading lot
Present as structured sub-sections."""
    },
    "declaration": {
        "section_name": "Declaration",
        "output_requirements": """Generate the declaration section containing:
1. Standard declaration by the Board of Directors
2. Individual declarations by each director (name, designation, DIN)
3. Declaration by the lead manager (placeholder)
4. Statement that the DRHP has been prepared in accordance with SEBI ICDR Regulations
5. Date and place of signing
Use the standard SEBI-prescribed declaration language.
Include [Signature] and [Date] placeholders for manual completion."""
    },
}


if __name__ == "__main__":
    for section_id, data in SECTIONS.items():
        content = BASE.format(
            section_name=data["section_name"],
            output_requirements=data["output_requirements"],
        )
        path = os.path.join(PROMPTS_DIR, f"{section_id}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Created: {path}")
