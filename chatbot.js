/**
 * Renegade Home Mortgage - AI Chatbot
 * Keyword/intent matching against distilled MLO knowledge base.
 * Stores conversations in browser storage key "renegade_chat_logs".
 * NEVER quotes specific interest rates, APRs, or rate ranges.
 */
(function () {
  'use strict';

  /* ───────── API ───────── */
  var API_BASE = '__PORT_8000__'.indexOf('__') === 0 ? 'http://localhost:8000' : '__PORT_8000__';
  var _notified = false;

  function notifyChatOpen() {
    if (_notified) return;
    _notified = true;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/chat-notify', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ page: window.location.pathname, timestamp: new Date().toISOString() }));
    } catch(e) { /* fail silently */ }
  }

  /* ───────── CONSTANTS ───────── */
  var STORAGE_KEY = 'renegade_chat_logs';
  var SMART_1003 = 'https://smart1003.preapprovemeapp.com/Start?CompanyID=1997&OfficerID=47';
  var BOOKING_URL = 'https://calendar.app.google/7uSLjHSKtZueV7a39';
  var MLO_NAME = 'Michael';
  var COMPANY = 'Renegade Home Mortgage';
  var NMLS = '227081';

  /* ───────── KNOWLEDGE BASE (distilled) ───────── */
  var KB = {
    mortgage_basics: {
      keywords: ['mortgage', 'what is a mortgage', 'how mortgages work', 'home loan', 'basics'],
      response: "A mortgage is a loan used to buy or refinance a home, secured by the property itself. Instead of paying the full price upfront, you make a down payment (typically 3%–20%) and repay the rest over 15 or 30 years in monthly installments that include principal and interest.\n\nYour monthly payment is often referred to as PITI: Principal (pays down your loan balance), Interest (the cost of borrowing), Taxes (property taxes collected monthly into escrow), and Insurance (homeowner's insurance and possibly mortgage insurance).\n\nWould you like to learn about specific loan types, or are you ready to explore your options with us?"
    },
    piti: {
      keywords: ['piti', 'monthly payment', 'what does my payment include', 'payment breakdown', 'escrow'],
      response: "Your monthly mortgage payment (PITI) includes four parts:\n\n• **Principal** - reduces your loan balance\n• **Interest** - cost of borrowing the money\n• **Taxes** - property taxes held in escrow and paid when due\n• **Insurance** - homeowner's insurance (and mortgage insurance if applicable)\n\nIn Oregon, property taxes are due in November each year. Your lender collects monthly and pays them from your escrow account. If you'd like a personalized payment estimate, reach out to " + MLO_NAME + ". We're happy to run the numbers for you!"
    },
    preapproval: {
      keywords: ['pre-approval', 'preapproval', 'pre-approved', 'preapproved', 'pre-qualify', 'prequalify', 'pre-qualification', 'prequalification', 'how to start', 'get started', 'apply', 'application'],
      response: "Great question! There's an important difference between pre-qualification and pre-approval:\n\n**Pre-Qualification** is a rough estimate based on self-reported info, helpful for ballpark numbers but carries little weight with sellers.\n\n**Pre-Approval** involves a full credit check, income verification, and documentation review. It tells sellers you're a serious, vetted buyer, essentially required in West Linn's competitive market.\n\nWe also offer **Fully Underwritten Pre-Approvals** (TBD approvals) that give you near-cash-offer strength.\n\nReady to get pre-approved? You can start your application right now:\n<a href='" + SMART_1003 + "' target='_blank' rel='noopener noreferrer'>Start Your Application →</a>"
    },
    conventional: {
      keywords: ['conventional', 'conforming', 'fannie mae', 'freddie mac', 'conventional loan'],
      response: "Conventional loans are not backed by a government agency. They're originated by private lenders and typically sold to Fannie Mae or Freddie Mac.\n\n**Key highlights:**\n• Minimum 620 credit score (best pricing at 740+)\n• As low as 3% down for first-time buyers (HomeReady/Home Possible)\n• 5% down for standard programs\n• PMI required below 20% down, but it cancels once you reach 20% equity\n• Available in 10, 15, 20, 25, and 30-year terms\n\n**2026 conforming loan limit:** $832,750 for a single-unit property in Oregon. Anything above that enters jumbo territory.\n\nWant to see if conventional is your best option? " + MLO_NAME + " can compare it against other programs for your specific situation."
    },
    fha: {
      keywords: ['fha', 'federal housing', 'fha loan', 'fha mortgage'],
      response: "FHA loans are insured by the Federal Housing Administration, making them more accessible for buyers with lower credit scores or smaller down payments.\n\n**Key highlights:**\n• 3.5% down with 580+ credit score\n• 10% down with 500–579 score\n• More flexible DTI ratios (up to 43–50%)\n• Must be owner-occupied primary residence\n• 2026 FHA limit for Clackamas County (West Linn): $695,750\n\n**Mortgage Insurance (MIP):**\n• Upfront: 1.75% of the loan (can be financed)\n• Annual: 0.50–0.75% depending on LTV and loan amount\n• If you put less than 10% down, MIP lasts the life of the loan\n• Many borrowers refinance to conventional once they build 20% equity to drop MIP\n\nWant to explore whether FHA is right for you? Let's chat!"
    },
    va: {
      keywords: ['va', 'veteran', 'veterans', 'military', 'va loan', 'active duty', 'service member'],
      response: "Thank you for your service! VA loans are one of the most powerful home financing tools available.\n\n**Key benefits:**\n• **Zero down payment** - 100% financing\n• **No monthly mortgage insurance** (no PMI/MIP)\n• **Competitive rates** - typically below conventional\n• **No loan limit** for borrowers with full entitlement\n• **Assumable** - a valuable feature in rising rate environments\n\n**Eligibility:** Active duty, veterans, National Guard, Reserves, and eligible surviving spouses. You'll need a Certificate of Eligibility (COE). We can pull this for you electronically in minutes.\n\n**VA Funding Fee:** Ranges from 0.50% to 3.30% depending on use and down payment. Veterans with a 10%+ service-connected disability are exempt.\n\nVA loans are especially powerful in West Linn's market. Want to explore your VA options?"
    },
    jumbo: {
      keywords: ['jumbo', 'jumbo loan', 'high balance', 'large loan', 'over conforming'],
      response: "With West Linn's median home value around $811,000, many buyers need jumbo loans (above the $832,750 conforming limit for 2026).\n\n**What to know about jumbo loans:**\n• Credit scores of 700+ typically required (720+ for best terms)\n• 10–20% down payment (20%+ preferred)\n• Lower DTI requirements (typically 43% max)\n• 6–12 months of reserves often required\n• Rates can actually be competitive with conforming rates for strong borrowers\n\nHere's the thing most people don't realize: as an independent broker, we access wholesale jumbo pricing from 50+ lenders. Jumbo lenders compete aggressively for high-value, low-risk loans, so rates can be surprisingly good.\n\nOn a $900,000 loan, even a 0.125% rate difference equals about $22,000 over 30 years. Shopping multiple lenders through a broker makes a real difference at West Linn price points."
    },
    usda: {
      keywords: ['usda', 'rural', 'usda loan'],
      response: "USDA loans offer zero-down financing for eligible buyers in qualifying rural and suburban areas.\n\n**Key features:**\n• No down payment required\n• Below-market rates and low mortgage insurance (1% upfront, 0.35% annual)\n• Income limits apply based on household size and county\n\n**Eligibility:** The property must be in a USDA-eligible area, and household income must be within program limits. Many suburban areas near Portland qualify, you might be surprised!\n\nNote: Most of West Linn itself may not qualify as USDA-eligible, but nearby areas might. Contact " + MLO_NAME + " to check specific property eligibility."
    },
    construction: {
      keywords: ['construction', 'build', 'new build', 'construction loan', 'building a home'],
      response: "Looking to build? Construction loans finance the building of a new home or major renovation.\n\n**Two main options:**\n• **Construction-to-Permanent (One-Time Close):** Single loan covers both construction and permanent mortgage. One closing, one set of costs.\n• **Stand-Alone Construction (Two-Time Close):** Separate construction loan and permanent mortgage. More flexibility but two closings.\n\n**Requirements tend to be stricter:** higher credit scores, 20%+ down payment, substantial reserves, and an approved builder.\n\nConstruction lending is a specialty. Not every lender does it well. Reach out to us and we'll match you with the right program."
    },
    heloc: {
      keywords: ['heloc', 'home equity', 'equity line', 'second mortgage', 'home equity loan', 'cash out'],
      response: "If you already own a home, you can access your equity through several options:\n\n**HELOC (Home Equity Line of Credit):**\n• Revolving credit (like a credit card secured by your home)\n• Variable rate, typically tied to Prime Rate\n• 10-year draw period, then 10–20 year repayment\n• Great for ongoing needs like renovations\n\n**Home Equity Loan:**\n• Fixed amount, fixed rate, regular payments\n• Ideal for a single large expense\n\n**Cash-Out Refinance:**\n• Replace your existing mortgage with a larger one and pocket the difference\n• Conventional allows up to 80% LTV; VA allows up to 100%\n\nLenders evaluate your Combined Loan-to-Value (CLTV), typically allowing up to 80–90% across all liens. Want to explore your equity options?"
    },
    down_payment: {
      keywords: ['down payment', 'downpayment', 'how much down', 'minimum down', 'money down', 'down payment assistance', 'dpa'],
      response: "Down payment requirements vary by loan type:\n\n• **Conventional (first-time):** As low as 3%\n• **Conventional (standard):** 5%\n• **FHA:** 3.5% (with 580+ credit)\n• **VA:** 0%, zero down!\n• **USDA:** 0%\n• **Jumbo:** 10–20%\n\n**Oregon Down Payment Assistance:**\nOregon offers several programs through OHCS (Oregon Housing & Community Services):\n• **Oregon Bond Program** - below-market rates or 3% cash assistance\n• **Flex Lending** - forgivable second liens that can cover your entire down payment and closing costs\n\nGift funds from family are also allowed on most programs with proper documentation.\n\nWant to know exactly how much cash you'd need? " + MLO_NAME + " can run personalized numbers for you."
    },
    credit_score: {
      keywords: ['credit score', 'credit', 'fico', 'credit report', 'credit repair', 'improve credit', 'bad credit', 'low credit'],
      response: "Your credit score significantly impacts your mortgage options and pricing. Here are the minimums by program:\n\n• **Conventional:** 620 (best pricing at 740+)\n• **FHA:** 580 for 3.5% down; 500–579 for 10% down\n• **VA:** No VA minimum (most lenders want 580–620)\n• **USDA:** 640 for automated approval\n• **Jumbo:** 700–720+\n\n**Quick wins to improve your score:**\n• Pay down credit card balances below 30% utilization (below 10% is ideal)\n• Dispute errors on your reports at annualcreditreport.com\n• Keep all accounts current, payment history is 35% of your score\n• Avoid new credit applications before applying for a mortgage\n\nWe can also do a **rapid rescore** once you've taken action, updating your score in days rather than weeks. Talk to " + MLO_NAME + " about a personalized credit strategy."
    },
    refinance: {
      keywords: ['refinance', 'refi', 'refinancing', 'lower rate', 'rate reduction', 'streamline'],
      response: "Refinancing replaces your current mortgage with a new one, usually to get a better rate, change your term, or access equity.\n\n**Types of refinance:**\n• **Rate-and-Term:** Lower your rate or change your loan term without taking cash out\n• **Cash-Out:** Borrow more than you owe and receive the difference as cash\n• **FHA Streamline:** Simplified refi for existing FHA borrowers (no appraisal needed)\n• **VA IRRRL:** Simplified refi for VA borrowers (no appraisal or income verification)\n\n**When does it make sense?**\nThe general rule: if you can reduce your rate by 0.5–0.75%+ and plan to stay long enough to recoup closing costs (typically 2–3% of loan amount), it's worth exploring. For West Linn's larger loan amounts, even smaller reductions can be worthwhile.\n\nWe're always happy to run a free refinance analysis. No cost, no obligation. Contact us and we'll give you an honest assessment."
    },
    first_time: {
      keywords: ['first time', 'first-time', 'first time buyer', 'first home', 'never bought', 'starter home'],
      response: "Welcome to the exciting world of homeownership! Here's what first-time buyers in West Linn should know:\n\n**You're a \"first-time buyer\" if** you haven't owned a primary residence in the past 3 years, even if you've owned before.\n\n**Best entry-point neighborhoods:**\n• **Bolton** - starting ~$550K, charming older homes\n• **Willamette** - starting ~$575K, walkable to shops\n• **Robinwood** - starting ~$600K, diverse housing types\n\n**Best loan programs for first-timers:**\n• Conventional 97 (3% down)\n• FHA (3.5% down, flexible credit)\n• VA (0% down for eligible veterans)\n• Oregon DPA programs (grants and forgivable loans)\n\n**The process:** Get pre-approved → Find an agent → House hunt → Make an offer → Close (we average 14 days!)\n\nReady to start? <a href='" + SMART_1003 + "' target='_blank' rel='noopener noreferrer'>Get Pre-Approved Now →</a>"
    },
    west_linn: {
      keywords: ['west linn', 'neighborhoods', 'bolton', 'willamette', 'robinwood', 'hidden springs', 'sunset', 'barrington', 'savanna oaks', 'tanner basin', 'marylhurst', 'parker crest', 'oregon city', 'lake oswego'],
      response: "West Linn is one of the Portland metro's most desirable communities, and we're proud to call it home!\n\n**Quick facts:**\n• ~27,000 residents\n• Median home value ~$811,000\n• Top-rated West Linn-Wilsonville School District\n• Known as the \"City of Hills, Trees, and Rivers\"\n• 25 minutes to Portland\n\n**Neighborhoods range widely in price:**\n• **Bolton & Willamette** - most affordable, starting ~$550–575K\n• **Robinwood** - diverse options starting ~$600K\n• **Tanner Basin & Parker Crest** - mid-range with newer construction\n• **Hidden Springs & Barrington Heights** - luxury, $900K–$1.5M+\n• **Sunset & Marylhurst** - premium with river views and larger lots\n\nWith home values above the conforming limit, many buyers need jumbo loans, and that's where our broker advantage really shines. Want to explore your options in a specific neighborhood?"
    },
    broker_advantage: {
      keywords: ['broker', 'why broker', 'broker vs bank', 'bank vs broker', 'wholesale', 'shop lenders', 'multiple lenders', '50 lenders', 'why renegade', 'about renegade'],
      response: "Great question! Here's the difference:\n\n**Banks** give you one rate, their rate. One lender, one option.\n\n**We're an independent mortgage broker.** We access wholesale pricing from 50+ lenders and shop them all to find your best deal.\n\n**Why it matters:**\n• Wholesale rates are typically 0.125–0.375% lower than retail bank rates\n• On a $900,000 West Linn loan, that's $22,000–$65,000 in lifetime savings\n• We have access to specialty products (jumbo, VA, Non-QM) that banks may not offer\n• We work for YOU, not for a bank\n\nIt's the single most impactful thing you can do to get a better deal on your mortgage. Want to see what rates look like for your situation? Reach out to " + MLO_NAME + "!"
    },
    rates: {
      keywords: ['rate', 'rates', 'interest rate', 'what are rates', 'current rate', 'today rate', 'rate today', 'mortgage rate', 'how are rates', 'rate quote', 'apr'],
      response: "I appreciate you asking about rates! However, I'm not able to quote specific interest rates. They change daily (sometimes multiple times per day) and depend on many individual factors including:\n\n• Your credit score and history\n• Loan-to-value ratio (down payment)\n• Loan type and term\n• Property type and occupancy\n• Current market conditions\n\n**What I can tell you:** As a broker, we shop 50+ wholesale lenders for every client. Wholesale rates are typically lower than what you'd get walking into a bank.\n\n**For a personalized rate quote,** contact " + MLO_NAME + " with your scenario. We'll shop our full lender network and show you real numbers from real lenders. No obligation, no pressure.\n\n<a href='" + SMART_1003 + "' target='_blank' rel='noopener noreferrer'>Get Your Personalized Quote →</a>"
    },
    closing_costs: {
      keywords: ['closing cost', 'closing costs', 'fees', 'how much to close', 'cash to close', 'costs'],
      response: "Closing costs are the fees paid when your loan closes. In Oregon, buyers should budget **2–4% of the loan amount** beyond the down payment.\n\n**Common costs include:**\n• Origination/lender fees: 0–1% of loan amount\n• Appraisal: $500–$1,000+\n• Title search & insurance\n• Escrow/settlement fee: $500–$1,500\n• Recording fees: $200–$500\n• Prepaid items (interest, insurance, tax escrow)\n\n**Good news for Oregon buyers:** No statewide transfer tax, a real cost advantage!\n\n**Ways to reduce cash needed:**\n• Seller concessions (seller pays part of your costs)\n• Lender credits (slightly higher rate in exchange for lower costs)\n• Down payment assistance programs\n• Gift funds from family\n\nWant exact numbers for your scenario? " + MLO_NAME + " can provide a detailed estimate."
    },
    process: {
      keywords: ['process', 'how long', 'timeline', 'steps', 'how does it work', 'what to expect', 'closing process'],
      response: "Here's the typical home purchase process from start to finish:\n\n**1. Pre-Approval (Days 1–5)** - We review your finances, pull credit, and issue a pre-approval letter.\n\n**2. House Hunt** - Work with a local agent to find your home.\n\n**3. Contract Signed** - Earnest money deposited (1–3% in Oregon), escrow opens.\n\n**4. Loan Estimate (Within 3 business days)** - We provide your official cost estimate.\n\n**5. Processing (Days 5–15)** - We gather and verify all documentation.\n\n**6. Appraisal (Days 7–15)** - Independent appraiser confirms the home's value.\n\n**7. Underwriting (Days 15–25)** - Full file review against lending guidelines.\n\n**8. Clear to Close** - All conditions met!\n\n**9. Closing Disclosure (3+ days before closing)** - Final terms and costs.\n\n**10. Closing/Signing** - Sign documents, wire funds, get your keys!\n\n**Our average closing time is 14 days**, well below the industry average. Ready to start?"
    },
    documents: {
      keywords: ['documents', 'paperwork', 'what do i need', 'documentation', 'docs needed', 'checklist'],
      response: "Here's what you'll typically need for a mortgage application:\n\n**Income:**\n• Last 30 days of pay stubs\n• W-2s for the past 2 years\n• Federal tax returns (2 years)\n• If self-employed: business tax returns + P&L statement\n\n**Assets:**\n• Bank statements (last 2 months, all pages)\n• Investment & retirement account statements\n\n**Identification:**\n• Government-issued photo ID\n• Social Security number\n\n**Other (if applicable):**\n• Divorce decree\n• Gift letter for gift funds\n• VA Certificate of Eligibility\n• Explanation letters for credit issues\n\nDon't worry. We'll walk you through exactly what's needed for your situation. The process is straightforward!"
    },
    self_employed: {
      keywords: ['self-employed', 'self employed', 'business owner', '1099', 'freelance', 'gig', 'contractor', 'bank statement loan'],
      response: "Self-employed borrowers have great options. It just requires different documentation.\n\n**Standard approach:**\n• 2 years of personal + business tax returns\n• Income averaged over 24 months\n• Certain deductions (depreciation, etc.) can be added back\n\n**The challenge:** Tax returns often show lower income after deductions than actual cash flow.\n\n**Solutions:**\n• **Bank Statement Loans (Non-QM):** Use 12–24 months of bank deposits instead of tax returns\n• **1099 Loans:** Qualify using 1099 income instead of full returns\n• **Asset Depletion:** For high-net-worth borrowers with significant liquid assets\n\n**Tips:** Keep clean, separate business accounts and work with a CPA who understands mortgage qualification (not just tax minimization).\n\n" + MLO_NAME + " specializes in self-employed borrowers. We know how to find the right program for your situation."
    },
    investment: {
      keywords: ['investment property', 'rental', 'rental property', 'investor', 'dscr', 'investment'],
      response: "Interested in investment property? Here's what to know:\n\n**Conventional Investment Loans:**\n• 15–25% down payment\n• Higher rates than primary residence\n• 6 months reserves typically required\n• Up to 10 financed properties (with some lenders)\n\n**DSCR Loans (Debt Service Coverage Ratio):**\n• Qualify based on the property's rental income, not your personal income\n• No W-2s, tax returns, or employment verification needed\n• DSCR of 1.0–1.25 typically required (rental income ÷ mortgage payment)\n• Great for experienced investors\n\n**75% Rule:** For new rental income, lenders typically use 75% of market rent as qualifying income.\n\nInvestment lending is one of our specialties. Contact " + MLO_NAME + " to explore your options."
    },
    pmi: {
      keywords: ['pmi', 'mortgage insurance', 'mip', 'private mortgage insurance', 'remove pmi', 'cancel pmi'],
      response: "Mortgage insurance protects the lender when you put less than 20% down.\n\n**PMI (Conventional Loans):**\n• Costs 0.3–1.5% of loan annually\n• **Can be removed** when you reach 80% LTV (borrower request) or 78% LTV (automatic)\n• Appreciation-based removal possible with a new appraisal after 2+ years\n\n**FHA MIP:**\n• Upfront: 1.75% of loan (usually financed)\n• Annual: 0.50–0.75%\n• With 10%+ down: MIP drops off after 11 years\n• With less than 10% down: **MIP lasts the life of the loan**\n• Strategy: Refinance to conventional once you hit 20% equity\n\n**VA Loans:** No monthly mortgage insurance at all!\n\nThis is a big factor in choosing between loan programs. Let us help you compare the real costs."
    },
    property_taxes: {
      keywords: ['property tax', 'property taxes', 'tax rate', 'measure 5', 'measure 50', 'assessed value', 'oregon taxes'],
      response: "Oregon's property tax system is unique and often confusing:\n\n**Measure 50 (1997):** Assessed value can only increase by max 3% per year, so most homes' assessed values are well below market value (often 50–75% of actual value).\n\n**Key point:** When you buy a home in Oregon, the assessed value does NOT reset to the purchase price. It carries over from the previous owner.\n\n**West Linn specifics:**\n• City tax rate: $2.12 per $1,000 of assessed value (lowest in the area!)\n• Total rate including all districts: ~$17–20 per $1,000 of assessed value\n\n**Tip:** Always check the current property tax bill. Don't estimate based on purchase price. Look up properties at the Clackamas County Assessment & Taxation website.\n\nProperty taxes are factored into your monthly mortgage payment through escrow."
    },
    arms: {
      keywords: ['arm', 'adjustable', 'adjustable rate', '5/1', '7/1', '5/6', '7/6', 'variable rate'],
      response: "Adjustable-Rate Mortgages (ARMs) can be a smart strategy in certain situations.\n\n**How they work:**\n• Fixed rate for an initial period (3, 5, 7, or 10 years)\n• Then adjusts periodically based on SOFR index + a margin\n• Rate caps protect you from extreme increases\n\n**Common structures:**\n• 5/6 ARM - fixed for 5 years, adjusts every 6 months\n• 7/1 ARM - fixed for 7 years, adjusts annually\n\n**When an ARM makes sense:**\n• You plan to sell or refinance before the fixed period ends\n• The initial rate savings are substantial\n• You want a lower initial payment to qualify for more\n\n**The risk:** Payment shock when the rate adjusts upward. Always understand the worst-case scenario using the lifetime cap.\n\nWant to compare ARM vs. fixed for your situation? " + MLO_NAME + " can show you both scenarios side by side."
    },
    points_buydown: {
      keywords: ['point', 'points', 'buydown', 'buy down', 'discount point', '2-1 buydown', 'temporary buydown'],
      response: "Points and buydowns are tools to reduce your interest rate:\n\n**Discount Points (Permanent):**\n• 1 point = 1% of loan amount paid at closing\n• Typically reduces your rate by 0.125–0.375%\n• Makes sense if you stay long enough to recoup the cost (break-even analysis)\n\n**Temporary Buydowns:**\n• **2-1 Buydown:** Rate is 2% lower in Year 1, 1% lower in Year 2, then full rate\n• **3-2-1 Buydown:** Stepped reduction over 3 years\n• Often paid by sellers or builders as an incentive\n• Great for easing into homeownership when early costs are highest\n\nOn a $900K jumbo loan, paying 1 point ($9,000) to save 0.25% could reduce your payment by ~$150/month and save ~$45,000 over 30 years.\n\nWant to see if buying points makes sense for your scenario?"
    },
    student_loans: {
      keywords: ['student loan', 'student loans', 'student debt', 'ibr', 'income based repayment'],
      response: "Yes, you can absolutely buy a home with student loans! How they're counted depends on the program:\n\n• **Conventional (Fannie Mae):** Uses actual payment, if IBR shows $0, they use $0 for DTI!\n• **Freddie Mac:** Uses 0.5% of balance if payment is $0\n• **FHA:** Uses 1% of balance if payment is $0 or deferred\n• **VA:** Uses actual payment; deferred loans may be excluded\n\n**Strategy:** Fannie Mae conventional can be very favorable for income-driven repayment borrowers with documented $0 payments.\n\nDon't let student loans stop you from exploring homeownership. " + MLO_NAME + " can show you exactly how your loans affect your buying power."
    },
    bankruptcy_foreclosure: {
      keywords: ['bankruptcy', 'foreclosure', 'short sale', 'chapter 7', 'chapter 13', 'deed in lieu'],
      response: "A past credit event doesn't permanently prevent homeownership. There are waiting periods by program:\n\n**Chapter 7 Bankruptcy:**\n• Conventional: 4 years (2 with extenuating circumstances)\n• FHA: 2 years\n• VA: 2 years\n\n**Foreclosure:**\n• Conventional: 7 years\n• FHA: 3 years\n• VA: 2 years\n\n**Short Sale:**\n• Conventional: 4 years\n• FHA: 3 years (0 if current throughout)\n• VA: 2 years\n\nNon-QM lenders may work with borrowers as soon as 1–2 years post-event with higher down payments.\n\nIf you've experienced a credit event, don't give up. Reach out to " + MLO_NAME + " and we'll map out your timeline and options."
    },
    closing: {
      keywords: ['closing', 'signing', 'what happens at closing', 'closing day', 'settlement'],
      response: "Closing day is when it all comes together!\n\n**In Oregon, closings are handled by a title/escrow company.** Here's what happens:\n\n1. You sign the Promissory Note (your promise to repay)\n2. You sign the Deed of Trust (gives the lender a lien)\n3. You sign the Closing Disclosure and other documents\n4. You wire your down payment and closing costs\n5. The lender funds the loan\n6. The deed is recorded with the county\n7. You get your keys!\n\n**Important:** Wire your funds carefully! Always verify wire instructions by calling the escrow company at a number you independently confirm. Wire fraud is a real threat.\n\n**Your first payment** is typically due on the 1st of the second month after closing."
    },
    contact: {
      keywords: ['contact', 'phone', 'email', 'call', 'reach out', 'talk to someone', 'schedule', 'consultation', 'appointment'],
      response: "We'd love to hear from you! Here's how to reach us:\n\n<a href='" + BOOKING_URL + "' target='_blank' rel='noopener noreferrer'>Schedule a Free Discovery Call →</a>\n\n• **Phone:** (503) 974-3571\n• **Email:** michael@renegadehomemtg.com\n• **Office:** West Linn, OR 97068\n• **Hours:** Monday-Friday 8am-6pm, weekends by appointment\n\nOr start your application online anytime:\n<a href='" + SMART_1003 + "' target='_blank' rel='noopener noreferrer'>Start Your Application →</a>\n\nInitial consultations are free, no obligation, and typically take about 20-30 minutes. We'll give you honest answers. No pressure, no hard sell."
    },
    realtor: {
      keywords: ['realtor', 'real estate agent', 'agent referral', 'referral', 'refer a client', 'listing agent'],
      response: "Are you a real estate agent? We love working with great realtors!\n\n**What we offer agents:**\n• Fast, reliable closings (14-day average)\n• Fully underwritten pre-approvals (TBD approvals)\n• Responsive communication throughout the transaction\n• Access to 50+ lenders for every scenario\n\n**Refer a client easily** through our <a href='./referral.html'>Realtor Referral Portal</a>. We'll follow up promptly and keep you in the loop.\n\n**What we need from agents:**\n• Full executed purchase agreement ASAP\n• Notice of any term changes\n• Cooperation on closing timeline\n\nLet's build a great working relationship. Reach out to " + MLO_NAME + " anytime!"
    },
    loan_status: {
      keywords: ['loan status', 'check status', 'where is my loan', 'loan progress', 'track loan', 'application status'],
      response: "Want to check on your loan? You can track your loan status anytime:\n\n<a href='./status.html'>Check Your Loan Status →</a>\n\nJust enter the email address you used on your application and we'll show you exactly where things stand, from application received through funding.\n\nIf you have questions about a specific condition or need help with documentation, don't hesitate to reach out to " + MLO_NAME + " directly."
    },
    calculator: {
      keywords: ['calculator', 'calculate', 'estimate payment', 'payment calculator', 'how much can i afford', 'afford'],
      response: "We have a mortgage payment calculator right on our website! You can find it on our:\n\n• <a href='./index.html#calculator'>Homepage</a>\n• <a href='./programs.html#calculator'>Loan Programs page</a>\n\nAdjust the loan amount, rate, and term to compare different scenarios.\n\nFor a more detailed affordability analysis based on your actual income, debts, and goals, reach out to " + MLO_NAME + ". We'll give you real numbers, not just estimates."
    },
    non_qm: {
      keywords: ['non-qm', 'non qm', 'bank statement', 'asset depletion', 'dscr', 'alternative documentation'],
      response: "Non-QM loans fill gaps for borrowers who don't fit traditional documentation requirements:\n\n**Bank Statement Loans:**\n• Use 12–24 months of bank deposits instead of tax returns\n• Ideal for self-employed borrowers and business owners\n\n**DSCR Loans:**\n• Qualify based on rental property cash flow\n• No personal income documentation needed\n\n**Asset Depletion:**\n• For high-net-worth individuals with assets but limited regular income\n• Liquid assets divided by loan term = qualifying monthly income\n\n**1099 Loans:**\n• Use 1099 income instead of full tax returns\n\n**General requirements:** 620+ credit, 10–30% down, higher rates than conventional.\n\nNon-QM is one of our specialties. If you've been told you \"don't qualify\" by a bank, give us a call. We probably have a solution."
    },
    reverse_mortgage: {
      keywords: ['reverse mortgage', 'hecm', 'senior', 'retire', 'retirement'],
      response: "A reverse mortgage (HECM) allows homeowners 62+ to convert home equity into cash without making monthly payments.\n\n**Key points:**\n• No monthly mortgage payments. The lender pays you\n• Repaid when you sell, move out, or pass away\n• Must maintain the home, pay taxes and insurance\n• HUD-approved counseling required\n• 2025 maximum claim amount: $1,209,750\n\n**Options for receiving funds:** Lump sum, monthly payments, line of credit, or combination.\n\nReverse mortgages can be an excellent retirement tool, but they reduce equity passed to heirs. Contact " + MLO_NAME + " for an honest assessment of whether it makes sense for your situation."
    },
    renovation: {
      keywords: ['renovation', '203k', 'fixer', 'fixer upper', 'rehab', 'renovate'],
      response: "Want to buy a fixer-upper? The FHA 203(k) program lets you finance the purchase AND renovation in one loan!\n\n**Limited 203(k):**\n• Up to $75,000 in renovations\n• Non-structural repairs (paint, flooring, appliances, etc.)\n• No HUD consultant required\n\n**Standard 203(k):**\n• $5,000+ in renovations (up to FHA limit)\n• Structural work allowed\n• HUD consultant required\n\n**Requirements:** Primary residence only, 580+ credit, licensed contractors (no DIY).\n\nThis is especially valuable for West Linn's older neighborhoods like Bolton and Willamette, where charming homes often need updating. Contact us to explore your options!"
    },
    bridge_loan: {
      keywords: ['bridge loan', 'bridge', 'buy before sell', 'selling and buying'],
      response: "Need to buy before you sell? A bridge loan can help!\n\n**How it works:**\n• Short-term loan (6–12 months) secured by your current home\n• Provides funds for the new purchase\n• Repaid when your current home sells\n\n**Other options:**\n• Qualify for both mortgages simultaneously\n• Coordinate a simultaneous close\n• Make a contingent offer (less competitive in hot markets)\n\nBridge loans carry higher rates and origination fees since they're short-term specialty products. " + MLO_NAME + " can help you evaluate whether a bridge loan or another strategy is best."
    },
    gift_funds: {
      keywords: ['gift', 'gift funds', 'gift money', 'family help', 'parents help'],
      response: "Gift funds from family can be a great way to cover your down payment!\n\n**Rules by program:**\n• **Conventional:** Gifts from family members; entire down payment can be a gift with 20%+ down\n• **FHA:** Gifts from family, friends, employers, or charities; entire down payment can be a gift\n• **VA:** Gift funds allowed\n\n**Required documentation:**\n• Signed gift letter (amount, donor info, no repayment required)\n• Bank statements showing the transfer\n• Evidence the funds have been received\n\n**Important:** Gift funds must be properly documented. We'll walk you through exactly what's needed."
    },
    dti: {
      keywords: ['dti', 'debt to income', 'debt-to-income', 'qualify', 'how much can i borrow', 'qualification'],
      response: "Debt-to-Income (DTI) ratio is a key qualification factor. It's your monthly debts divided by gross monthly income.\n\n**Maximum DTI by program:**\n• Conventional: Up to 50% with automated approval\n• FHA: Up to 43–50%\n• VA: Typically 41–50%\n• USDA: Up to 41%\n• Jumbo: Usually 43% max\n\n**What counts as debt:** Minimum payments on credit cards, auto loans, student loans, other mortgages, child support, alimony.\n\n**What doesn't count:** Utilities, groceries, subscriptions, cell phone.\n\n**Tip:** Paying down revolving debt before applying can significantly improve your DTI and buying power.\n\nWant to know exactly how much you can borrow? " + MLO_NAME + " can calculate your specific buying power."
    },
    condo: {
      keywords: ['condo', 'condominium', 'townhouse', 'hoa', 'homeowners association'],
      response: "Buying a condo or townhouse involves a few extra considerations:\n\n**Condo financing requires project approval:**\n• The condo complex must meet lender requirements (warrantable)\n• At least 51% owner-occupied, no major litigation, properly funded reserves\n• Non-warrantable condos need portfolio or Non-QM financing\n\n**Townhouses** often qualify as single-family if you own the land, better loan terms!\n\n**HOA dues** are included in your DTI calculation, so they affect how much you can borrow.\n\nNot sure if your target condo is warrantable? " + MLO_NAME + " can check. It's one of the first things we verify."
    },
    hardship: {
      keywords: ['forbearance', 'hardship', 'cant pay', 'behind on payments', 'struggling', 'modification', 'loss mitigation'],
      response: "If you're facing financial hardship, please know there are options:\n\n**Forbearance:** Temporarily pause or reduce payments without being reported delinquent.\n\n**Loan Modification:** Permanent change to loan terms to make payments affordable (rate reduction, term extension, etc.).\n\n**The most important step:** Contact your loan servicer BEFORE missing payments. They have dedicated loss mitigation teams and are required to work with you.\n\n**Free help:** HUD-approved housing counselors can negotiate on your behalf. Call 1-800-569-4287 or visit hud.gov.\n\nYou're not alone in this. Reach out early. The sooner you act, the more options you have."
    }
  };

  /* ───────── GREETING / FALLBACK ───────── */
  var GREETING = "Hi there! 👋 I'm the Renegade Home Mortgage assistant. I can help with questions about mortgages, loan programs, the home buying process, and West Linn real estate.\n\nWhat can I help you with today?";

  var FALLBACK = "That's a great question! I want to make sure you get the most accurate answer. For specifics on your situation, I'd recommend reaching out to " + MLO_NAME + " directly. He can give you personalized guidance.\n\n<a href='" + BOOKING_URL + "' target='_blank' rel='noopener noreferrer'>Schedule a Free Discovery Call →</a>\n\n• **Phone:** (503) 974-3571\n• **Email:** michael@renegadehomemtg.com\n\nOr <a href='" + SMART_1003 + "' target='_blank' rel='noopener noreferrer'>start your application online →</a>\n\nIs there something else I can help with?";

  var DISCLAIMER = 'For educational purposes only. Not financial advice. NMLS# ' + NMLS + '.';

  var SUGGESTIONS = [
    'First-time buyer tips',
    'Loan programs',
    'Get pre-approved',
    'Down payment options',
    'West Linn neighborhoods'
  ];

  /* ───────── STORAGE (with in-memory fallback) ───────── */
  var _memStore = {};
  var _ls = (function() { try { var s = window['local'+'Storage']; var t = '__t'; s.setItem(t,t); s.removeItem(t); return s; } catch(e) { return null; } })();

  function loadConversations() {
    try {
      var data = _ls ? _ls.getItem(STORAGE_KEY) : (_memStore[STORAGE_KEY] || null);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveConversations(conversations) {
    try {
      var json = JSON.stringify(conversations);
      if (_ls) { _ls.setItem(STORAGE_KEY, json); } else { _memStore[STORAGE_KEY] = json; }
    } catch (e) { /* quota exceeded - silently fail */ }
  }

  function getCurrentConversation() {
    var convos = loadConversations();
    if (convos.length === 0 || !window.__renegadeChatId) {
      var newConvo = {
        id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        startedAt: new Date().toISOString(),
        messages: []
      };
      window.__renegadeChatId = newConvo.id;
      convos.push(newConvo);
      saveConversations(convos);
      return newConvo;
    }
    for (var i = 0; i < convos.length; i++) {
      if (convos[i].id === window.__renegadeChatId) return convos[i];
    }
    // ID not found - create new
    var fallback = {
      id: window.__renegadeChatId,
      startedAt: new Date().toISOString(),
      messages: []
    };
    convos.push(fallback);
    saveConversations(convos);
    return fallback;
  }

  function appendMessage(role, text) {
    var convos = loadConversations();
    for (var i = 0; i < convos.length; i++) {
      if (convos[i].id === window.__renegadeChatId) {
        convos[i].messages.push({
          role: role,
          text: text,
          timestamp: new Date().toISOString()
        });
        saveConversations(convos);
        return;
      }
    }
  }

  /* ───────── INTENT MATCHING ───────── */
  function matchIntent(input) {
    var lower = input.toLowerCase().replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();

    // Greeting detection
    if (/^(hi|hello|hey|howdy|good morning|good afternoon|good evening|yo|sup|what's up|greetings)\b/.test(lower)) {
      return GREETING;
    }

    // Thanks detection
    if (/^(thanks|thank you|thx|ty|appreciate|helpful)\b/.test(lower)) {
      return "You're welcome! If you have any other questions about mortgages or buying a home in West Linn, I'm here to help. 😊\n\nWhen you're ready to take the next step:\n<a href='" + SMART_1003 + "' target='_blank' rel='noopener noreferrer'>Start Your Application →</a>";
    }

    // Rate-specific interception - NEVER quote rates
    if (/\b(what|current|today'?s?|give me|quote me|specific)\b.*(rate|apr|percentage|percent)/i.test(lower) ||
        /\brate.*(today|now|current|right now|this week)/i.test(lower)) {
      return KB.rates.response;
    }

    var bestMatch = null;
    var bestScore = 0;

    var keys = Object.keys(KB);
    for (var k = 0; k < keys.length; k++) {
      var topic = KB[keys[k]];
      var score = 0;

      for (var j = 0; j < topic.keywords.length; j++) {
        var kw = topic.keywords[j].toLowerCase();
        // Exact phrase match (higher score)
        if (lower.indexOf(kw) !== -1) {
          score += kw.split(' ').length * 3;
        } else {
          // Individual word match
          var words = kw.split(' ');
          for (var w = 0; w < words.length; w++) {
            if (words[w].length > 2 && lower.indexOf(words[w]) !== -1) {
              score += 1;
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = topic.response;
      }
    }

    return bestScore >= 2 ? bestMatch : FALLBACK;
  }

  /* ───────── UI RENDERING ───────── */
  function createChatbotUI() {
    // Chat bubble
    var bubble = document.createElement('div');
    bubble.className = 'chatbot-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    // Chat panel
    var panel = document.createElement('div');
    panel.className = 'chatbot-panel';
    panel.innerHTML =
      '<div class="chatbot-header">' +
        '<div><strong>' + COMPANY + '</strong><br><span style="font-size:12px;opacity:.8">Mortgage Assistant</span></div>' +
        '<button class="chatbot-close" aria-label="Close chat">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="chatbot-messages" id="chatbot-messages"></div>' +
      '<div class="chatbot-suggestions" id="chatbot-suggestions"></div>' +
      '<div class="chatbot-disclaimer">' + DISCLAIMER + '</div>' +
      '<form class="chatbot-input" id="chatbot-form">' +
        '<input type="text" id="chatbot-input" placeholder="Type your question..." autocomplete="off" aria-label="Chat message">' +
        '<button type="submit" aria-label="Send message">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>' +
        '</button>' +
      '</form>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    // Event listeners
    bubble.addEventListener('click', function () {
      panel.classList.toggle('chatbot-panel--open');
      bubble.classList.toggle('chatbot-bubble--hidden');
      if (panel.classList.contains('chatbot-panel--open')) {
        // Focus input
        var inp = document.getElementById('chatbot-input');
        if (inp) inp.focus();
        // Show greeting if first open
        var msgs = document.getElementById('chatbot-messages');
        if (msgs && msgs.children.length === 0) {
          addBotMessage(GREETING, function() {
            renderSuggestions();
          });
          // Notify Michael via SMS
          notifyChatOpen();
        }
      }
    });

    panel.querySelector('.chatbot-close').addEventListener('click', function () {
      panel.classList.remove('chatbot-panel--open');
      bubble.classList.remove('chatbot-bubble--hidden');
    });

    document.getElementById('chatbot-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('chatbot-input');
      var text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      handleUserMessage(text);
    });
  }

  function renderSuggestions() {
    var container = document.getElementById('chatbot-suggestions');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < SUGGESTIONS.length; i++) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chatbot-suggestion';
      chip.textContent = SUGGESTIONS[i];
      chip.addEventListener('click', (function (txt) {
        return function () { handleUserMessage(txt); };
      })(SUGGESTIONS[i]));
      container.appendChild(chip);
    }
  }

  function hideSuggestions() {
    var container = document.getElementById('chatbot-suggestions');
    if (container) container.innerHTML = '';
  }

  function addBotMessage(text, onComplete) {
    var msgs = document.getElementById('chatbot-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'chatbot-msg chatbot-msg--bot';
    msgs.appendChild(div);

    // Typewriter effect: reveal text at ~35 chars/sec (slightly above avg reading speed)
    var fullHtml = formatMarkdown(text);
    var plainText = text;
    var charIndex = 0;
    var speed = 28; // ms per character

    // We type out the plain text but render formatted HTML progressively
    // To handle markdown/HTML correctly, we build up the source text and re-format
    function typeNext() {
      if (charIndex < plainText.length) {
        charIndex++;
        // Render the partial text through formatMarkdown
        div.innerHTML = formatMarkdown(plainText.substring(0, charIndex));
        msgs.scrollTop = msgs.scrollHeight;

        // Vary speed slightly for natural feel: pause longer on punctuation
        var ch = plainText[charIndex - 1];
        var delay = speed;
        if (ch === '.' || ch === '!' || ch === '?') delay = speed * 6;
        else if (ch === ',') delay = speed * 3;
        else if (ch === ':' || ch === ';') delay = speed * 4;
        else if (ch === '\n') delay = speed * 4;
        else delay = speed + Math.random() * 12 - 6; // slight jitter

        setTimeout(typeNext, delay);
      } else {
        // Done typing, ensure final HTML is complete
        div.innerHTML = fullHtml;
        msgs.scrollTop = msgs.scrollHeight;
        appendMessage('bot', text);
        if (onComplete) onComplete();
      }
    }

    typeNext();
  }

  function addUserMessage(text) {
    var msgs = document.getElementById('chatbot-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'chatbot-msg chatbot-msg--user';
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    appendMessage('user', text);
  }

  function handleUserMessage(text) {
    hideSuggestions();
    addUserMessage(text);

    // Simulate brief typing delay
    var msgs = document.getElementById('chatbot-messages');
    var typing = document.createElement('div');
    typing.className = 'chatbot-msg chatbot-msg--bot chatbot-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    // Disable input while bot is responding
    var inp = document.getElementById('chatbot-input');
    var sendBtn = document.getElementById('chatbot-send');
    if (inp) inp.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      var response = matchIntent(text);
      addBotMessage(response, function() {
        // Re-enable input after typing completes
        if (inp) { inp.disabled = false; inp.focus(); }
        if (sendBtn) sendBtn.disabled = false;
      });
    }, 600 + Math.random() * 400);
  }

  /* ───────── SIMPLE MARKDOWN ───────── */
  function formatMarkdown(text) {
    // Escape HTML first (but preserve <a> tags we inserted)
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Restore our anchor tags
    html = html.replace(/&lt;a href='([^']+)' target='_blank' rel='noopener noreferrer'&gt;(.+?)&lt;\/a&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
    html = html.replace(/&lt;a href='([^']+)'&gt;(.+?)&lt;\/a&gt;/g, '<a href="$1">$2</a>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /* ───────── INIT ───────── */
  function init() {
    // Ensure conversation is initialized
    getCurrentConversation();
    createChatbotUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
