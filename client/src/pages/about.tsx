import { useState } from "react";
import { PublicPageLayout } from "@/components/public-page-layout";
import { MapPin, Building2, Target, ShieldCheck, Brain, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
        <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-lg">Message sent!</p>
          <p className="text-sm text-muted-foreground">Thanks for reaching out. We'll get back to you soon.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setStatus("idle"); setForm({ name: "", email: "", subject: "", message: "" }); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
            name="name"
            placeholder="Your name"
            value={form.name}
            onChange={handleChange}
            required
            disabled={status === "loading"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
            disabled={status === "loading"}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-subject">Subject</Label>
        <Input
          id="contact-subject"
          name="subject"
          placeholder="What's this about?"
          value={form.subject}
          onChange={handleChange}
          required
          disabled={status === "loading"}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          placeholder="Tell us how we can help..."
          rows={5}
          value={form.message}
          onChange={handleChange}
          required
          disabled={status === "loading"}
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
      )}
      <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto gap-2">
        {status === "loading" ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
        ) : (
          <><Send className="h-4 w-4" /> Send Message</>
        )}
      </Button>
    </form>
  );
}

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <div className="space-y-12">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">About FinVision360</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Your complete personal finance intelligence platform — built to give you a 360° view of your financial life.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Tooothy LLC</h2>
              <p className="text-sm text-muted-foreground">Parent Company</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            FinVision360.com is a product of <strong>Tooothy LLC</strong>, a Northbrook, IL based company dedicated to
            building smart, approachable technology products that help people take control of their financial futures.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Northbrook, Illinois, United States</span>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            We believe everyone deserves a clear, complete picture of their finances — not just a bank balance or a credit
            score, but a true 360° view that includes assets, liabilities, retirement readiness, insurance, and intelligent
            forecasting. FinVision360 brings all of that into one place, making it easy to understand where you are today and
            plan for where you want to be tomorrow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Target,
              title: "Built for Clarity",
              desc: "We strip away complexity and surface the numbers that actually matter to your financial health — net worth, asset allocation, debt-to-income, and more.",
            },
            {
              icon: Brain,
              title: "AI-Powered Guidance",
              desc: "Our AI Advisor understands your full financial picture and gives you personalized strategies for debt payoff, retirement planning, and net worth growth.",
            },
            {
              icon: ShieldCheck,
              title: "Security First",
              desc: "Your financial data is stored securely with industry-standard encryption and session-based authentication. We never sell or share your personal data.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border bg-card p-6 space-y-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">What FinVision360 Offers</h2>
          <ul className="space-y-3">
            {[
              "Net worth dashboard with real-time asset and liability tracking",
              "Asset allocation visualization with category breakdowns",
              "Debt management with interest rate analysis",
              "Retirement planning calculators including 401(k) and Social Security projections",
              "Income and expense tracking by category",
              "Insurance policy management",
              "AI-powered financial advisor for scenario analysis and debt strategy",
              "Bank rate monitoring to find the best savings and lending rates",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Contact Us</h2>
            <p className="text-sm text-muted-foreground">
              Have questions or feedback? Fill out the form and we'll get back to you.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>Tooothy LLC · Northbrook, IL</span>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
    </PublicPageLayout>
  );
}
