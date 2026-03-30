# Renegade AIO Master Class - Email Nurture Sequence

Trigger: User enrolls via masterclass.html lead capture form.
From: michael@renegadehomemtg.com
Reply-To: michael@renegadehomemtg.com

---

## Email 1: Welcome + Module 1 (Immediate)

**Subject:** You're in. Here's the truth about your mortgage.

**Body:**

Hey {{first_name}},

Welcome to the Interest-Killer Master Class.

Before we get started, here's a number: **$637,564**.

That's how much interest you'll pay on a standard $500K mortgage at 6.5% over 30 years. The bank collects most of it in the first decade, while your equity barely moves.

Module 1 breaks down exactly how this works, and why no one explains it to you at closing.

[Start Module 1: The Great Mortgage Lie](https://renegadehomemtg.com/masterclass/module-1.html)

Talk soon,
Michael Neef
Renegade Home Mortgage
(503) 974-3571

P.S. If you have a current mortgage statement handy, pull it out before you start. You'll want to see where your money is actually going.

---

## Email 2: The Mechanism (Day 2)

**Subject:** What if your checking account could kill your mortgage?

**Body:**

{{first_name}},

Yesterday you saw the problem. Today, let's look at the solution.

The All-In-One mortgage is simple in concept: it combines your mortgage and your checking account into one instrument. Every dollar you deposit immediately reduces your principal. Interest is calculated nightly on whatever balance remains.

The result? Your idle money - the cash sitting in your checking account between paychecks - stops costing you and starts working for you. 24 hours a day, 7 days a week.

Module 2 explains exactly how "The Sweep" works.

[Start Module 2: The Anatomy of an All-In-One](https://renegadehomemtg.com/masterclass/module-2.html)

One thing I hear a lot: "This sounds too good to be true." It's not. It's just math. And the math is not close.

Michael

---

## Email 3: The Math (Day 4)

**Subject:** $8,000 income. $5,000 expenses. Here's what happens.

**Body:**

{{first_name}},

Let's stop talking theory and run real numbers.

A household earning $10,000/month with $5,000 in expenses has a $5,000 surplus. In a traditional mortgage, that surplus sits in a savings account earning almost nothing while the mortgage charges interest on the full balance.

In an AIO, that same $5,000 attacks the principal every single day. The difference over time is staggering:

- Traditional 30-year fixed: **30 years**, $632K in interest
- All-In-One: roughly **12 years**, $247K in interest
- You save: **$385,000** and nearly **18 years**

Module 3 shows the full math. There's also an interactive calculator where you can plug in your own numbers.

[Start Module 3: Velocity of Money](https://renegadehomemtg.com/masterclass/module-3.html)

Michael

P.S. The calculator is the most popular part of the master class. Try it with your actual income and expenses.

---

## Email 4: The Safety Net (Day 6)

**Subject:** "What happens if I lose my job?"

**Body:**

{{first_name}},

It's the question everyone asks. And it's a good one.

With a traditional mortgage, if you lose your income, you're in trouble fast. Fixed payment, no flexibility, and all the equity you've built is locked inside the home. You can't access it without selling or refinancing - which requires the income you just lost.

The AIO flips this entirely.

Your equity is accessible 24/7 via a debit card or checkbook. Your "payment" is flexible (interest-only minimum). You have a built-in bridge to get through tough times without selling your home.

Module 4 walks through a real scenario of a family navigating job loss with an AIO versus a traditional mortgage. The difference is night and day.

[Start Module 4: The Recession-Proof Home](https://renegadehomemtg.com/masterclass/module-4.html)

Michael

---

## Email 5: The Close (Day 8)

**Subject:** Is the AIO right for you? (Honest answer inside)

**Body:**

{{first_name}},

This is the final module, and it's the most important one.

I'll be straight with you: the All-In-One mortgage is not for everyone. If you spend more than you make, or you're not comfortable with a variable rate, it's the wrong product. A traditional 30-year fixed is the better choice.

But if you have even $100 left over at the end of the month, the AIO can change your financial trajectory. The math doesn't lie.

Module 5 gives you the honest filter: who this is for, who it's not for, and the exact next steps if you want to explore it further.

[Start Module 5: Is This For You?](https://renegadehomemtg.com/masterclass/module-5.html)

And when you're ready, run your personalized numbers:

[Open the AIO Savings Calculator](https://renegadehomemtg.com/masterclass/calculator.html)

If the numbers make sense for your situation, I'd love to walk you through it in person. No pressure, no obligation, just a straight conversation about whether this is the right move for you.

[Schedule a Free Consultation](https://renegadehomemtg.com/book.html)

Or call me directly: (503) 974-3571

Stop paying for the bank's headquarters. Start paying for your future.

Michael Neef
Renegade Home Mortgage
NMLS# 227081

---

## CRM Field Mapping

| Form Field | CRM Field | Notes |
|---|---|---|
| first_name | Contact.FirstName | |
| last_name | Contact.LastName | |
| email | Contact.Email | Primary, used for sequence trigger |
| phone | Contact.Phone | |
| source | Contact.LeadSource | Always "masterclass" |
| enrollment_date | Contact.CustomField1 | Auto-set at enrollment |

## Sequence Timing

| Email | Delay | Trigger |
|---|---|---|
| Email 1 | Immediate | Form submission |
| Email 2 | Day 2 (48 hours) | Timer |
| Email 3 | Day 4 (96 hours) | Timer |
| Email 4 | Day 6 (144 hours) | Timer |
| Email 5 | Day 8 (192 hours) | Timer |

## Notes
- All emails use plain text formatting with minimal HTML (one CTA button per email)
- Unsubscribe link required in footer of each email
- Track opens and clicks for each email
- If user clicks the calculator link in Email 3 or 5, tag them as "Calculator Engaged"
- If user clicks the booking link in Email 5, tag them as "Consultation Requested"
