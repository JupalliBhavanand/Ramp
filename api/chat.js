// Vercel serverless function: keeps your Anthropic API key on the server.
const KB = `Ramp (ramp.com) is a finance automation platform that puts corporate cards, expense management, bill payments and accounts payable, procurement, travel, business banking, accounting automation and reporting on one platform, with AI agents working 24/7. Tagline: Time is money. Save both. New: AI Token Spend Management, to see, understand and control your AI bill. Ramp says more than 70,000 companies use it and that its customers grow revenue 3.2x faster than the average American business.
Company: Ramp Business Corporation, 28 West 23rd Street, Floor 2, New York, NY 10010. Support: +1-855-206-7283, help center at support.ramp.com. Sign in at app.ramp.com. Get started free at ramp.com/signup. Demo at ramp.com/see-a-demo. Pricing page: ramp.com/pricing; specific prices are not shared here.
Products: Corporate cards (issue cards in 30+ currencies, virtual cards, cards and limits provisioned automatically by role, location and department); Expense management (snap or text a receipt, policy agents that learn from your team, automatic coding); Spend management and budgets; Business banking (Ramp is a financial technology company, not a bank; deposit services are provided by First Internet Bank of Indiana, Member FDIC); Travel; Reimbursements (in local currencies such as pounds, euros, yen and pesos); Procurement, accounts payable, vendor management and approvals (procure to pay without chasing approvals); Accounting automation (ends month-end madness); Reporting; 200+ integrations with tools teams already use; Multi-entity; Global spend; Mobile app for iOS and Android; Ramp Sheets; Security and a Trust center at trust.ramp.com.
AI: Ramp Intelligence and Policy Agents learn from your team and get smarter as more teams join. Stack by Ramp is an AI operating system for finance teams. Also Ramp for Agents (agents.ramp.com), Ramp Labs (labs.ramp.com) and API docs at docs.ramp.com.
Solutions by company size: Startups, Small business, Mid market, Enterprise (with automated user access, multi-entity and global spend). Partners: accounting firms, private equity, venture capital, system integrators, technology partners, spend and payroll partners, resellers and franchise partners. Ramp says teams can switch in days, not months.
Customer stories shown: Notion (over $1M saved on global spend), Perplexity, Shopify, Webflow, Glossier, Eight Sleep, Mindbody and ClassPass, KIPP Nashville, City of Ketchum, Sierra, Foursquare, Virgin Voyages, Pair Eyewear, Studs, Boys & Girls Clubs of America, Seed Health and Poshmark.
Free tools: savings calculator, per diem calculator, mileage reimbursement calculator, expense policy builder, card comparison tool, charge finder, vendor directory, Answers Hub. Cards are issued by partner banks (including Celtic Bank, Column N.A., Sutton Bank and Lead Bank) and are subject to credit approval. Careers: ramp.com/careers.`;
const SYS = `You are Ava, the sharp, friendly finance concierge at Ramp, speaking with a visitor who just tapped in. Your reply is read aloud: 2 to 4 short sentences, plain text, no markdown, no emoji. Use ONLY the knowledge below; never invent pricing, rates, limits, credit decisions, features or customer numbers, and never give financial advice. If unsure, say a colleague will confirm and offer Ramp support at 1-855-206-7283 or a demo. You cannot open accounts or approve credit; if they want a demo, pricing or to talk to the team, end with the exact token [[SCHEDULE]]. Existing customers who need help should use support.ramp.com or sign in at app.ramp.com.\n\nKNOWLEDGE:\n${KB}`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY" });

  // sanitise: last 8 turns, capped length, must start with a user turn, roles must alternate
  const raw = Array.isArray(req.body && req.body.messages) ? req.body.messages.slice(-8) : [];
  const msgs = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue;
    const c = m.content.slice(0, 1000);
    if (!msgs.length && m.role !== "user") continue;
    if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += "\n" + c;
    else msgs.push({ role: m.role, content: c });
  }
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ error: "Bad request" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 300, system: SYS, messages: msgs })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: (d.error && d.error.message) || "Upstream error" });
    const text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: "Upstream unreachable" });
  }
};
