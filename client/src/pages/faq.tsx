import { useState } from "react";
import { PublicPageLayout } from "@/components/public-page-layout";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    category: "Getting Started",
    items: [
      {
        q: "What is FinVision360?",
        a: "FinVision360 is a personal finance intelligence platform that gives you a complete 360° view of your finances. You can track assets and liabilities, monitor net worth, plan for retirement, manage income and expenses, and get AI-powered financial guidance — all in one place. FinVision360.com is a product of Tooothy LLC, a Northbrook, IL based company.",
      },
      {
        q: "Is FinVision360 free to use?",
        a: "FinVision360 offers a free account so you can start tracking your finances right away. Simply click 'Get Started' on the homepage, create an account, and begin entering your financial data.",
      },
      {
        q: "How do I create an account?",
        a: "Click 'Get Started' or 'Sign In' on the landing page, then select the 'Create Account' tab. Enter your username, a secure password, and optionally your name and email. You'll be logged in and ready to go immediately.",
      },
      {
        q: "Is there a demo account I can try?",
        a: "Yes! You can log in with username 'demo' and password 'demo123' to explore the app with pre-filled sample financial data before creating your own account.",
      },
    ],
  },
  {
    category: "Your Financial Data",
    items: [
      {
        q: "What types of assets can I track?",
        a: "You can track bank accounts, savings accounts, investments, brokerage accounts, retirement funds (401k, IRA, Roth IRA), real estate, vehicles, cash, and more. Each asset can have a name, category, value, interest/return rate, and institution name.",
      },
      {
        q: "What types of liabilities can I track?",
        a: "You can track mortgages, auto loans, student loans, personal loans, credit cards, home equity lines of credit (HELOC), and other debt. Each liability stores the outstanding balance, interest rate, minimum payment, and due date.",
      },
      {
        q: "How is my net worth calculated?",
        a: "Net Worth = Total Assets − Total Liabilities. On the dashboard, you can selectively include or exclude individual assets and liabilities from the calculation using checkboxes. This is useful for scenario planning, such as seeing your net worth excluding illiquid assets.",
      },
      {
        q: "What is the Rate of Return Spread?",
        a: "The Rate of Return Spread shows the difference between your weighted average asset return rate and your weighted average liability interest rate. A positive spread means your assets are earning more than your debts are costing you — a healthy financial position.",
      },
    ],
  },
  {
    category: "Retirement Planning",
    items: [
      {
        q: "What retirement planning tools are available?",
        a: "FinVision360 includes a general Retirement Goal Calculator, a 401(k) Projection tool with employer matching and tax bracket modeling, and a Social Security estimator. You can set a target retirement age and goal amount, and see whether you're on track.",
      },
      {
        q: "How does the 401(k) calculator work?",
        a: "Enter your current balance, annual contribution, employer match percentage, expected return rate, years to retirement, and tax filing status. The calculator projects your balance at retirement accounting for compound growth, employer contributions, and estimated tax impact.",
      },
    ],
  },
  {
    category: "AI Advisor",
    items: [
      {
        q: "What can the AI Advisor help me with?",
        a: "The AI Advisor can analyze your full financial picture and help with: debt payoff strategies (avalanche vs. snowball method), net worth forecasting over 10+ years, scenario analysis (e.g., 'What if I increase my monthly savings by $500?'), and open-ended financial questions.",
      },
      {
        q: "Is the AI Advisor advice I should act on?",
        a: "The AI Advisor provides educational and organizational insights based on the data you've entered. It is not a licensed financial advisor. You should always consult a qualified financial professional before making significant financial decisions. See our Terms and Conditions for full details.",
      },
      {
        q: "Does the AI see all my financial data?",
        a: "When you use the AI Advisor, a summary of your assets, liabilities, and financial profile is sent to OpenAI's API to generate your personalized response. Your name and email are not included in that request. See our Privacy Policy for more details.",
      },
    ],
  },
  {
    category: "Security and Privacy",
    items: [
      {
        q: "Is my financial data secure?",
        a: "Yes. Your data is stored in an encrypted PostgreSQL database, all connections are secured with HTTPS/TLS, and your password is hashed using the industry-standard scrypt algorithm. We never store your raw password.",
      },
      {
        q: "Does FinVision360 connect to my bank accounts?",
        a: "No. FinVision360 does not connect to your bank or request any banking credentials. All financial data is entered manually by you. This is by design — we prioritize privacy and give you full control over what you share.",
      },
      {
        q: "Can I delete my account and data?",
        a: "Yes. You can request deletion of your account and all associated data by emailing hello@finvision360.com. We will process your request promptly.",
      },
      {
        q: "Who operates FinVision360?",
        a: "FinVision360.com is operated by Tooothy LLC, a Northbrook, IL based company. For privacy or security concerns, please contact us at hello@finvision360.com.",
      },
    ],
  },
  {
    category: "Account and Settings",
    items: [
      {
        q: "How do I update my profile information?",
        a: "Go to Settings (accessible from the top navigation). From there you can update your full name and email address.",
      },
      {
        q: "How do I change my password?",
        a: "In the Settings page, use the 'Change Password' section. Enter your current password, then your new password. Passwords must be at least 6 characters.",
      },
      {
        q: "Does FinVision360 support dark mode?",
        a: "Yes! Toggle between light and dark mode using the moon/sun icon in the navigation bar at the top of any page.",
      },
    ],
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-medium leading-relaxed">{question}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <PublicPageLayout>
      <div className="space-y-12">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Frequently Asked Questions</h1>
          <p className="text-muted-foreground leading-relaxed">
            Everything you need to know about FinVision360. Can't find what you're looking for?{" "}
            <a href="mailto:hello@finvision360.com" className="underline hover:text-foreground">
              Email us
            </a>{" "}
            and we'll be happy to help.
          </p>
        </div>

        {faqs.map((section) => (
          <div key={section.category} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{section.category}</h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <FAQItem key={item.q} question={item.q} answer={item.a} />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl border bg-card p-6 space-y-2">
          <p className="font-medium">Still have questions?</p>
          <p className="text-sm text-muted-foreground">
            Reach out to the team at Tooothy LLC — the Northbrook, IL based company behind FinVision360.
          </p>
          <a
            href="mailto:hello@finvision360.com"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            hello@finvision360.com →
          </a>
        </div>
      </div>
    </PublicPageLayout>
  );
}
