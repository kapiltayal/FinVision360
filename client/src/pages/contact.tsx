import { useState } from "react";
import { PublicPageLayout } from "@/components/public-page-layout";
import { MapPin, Send, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
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

  return (
    <PublicPageLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-muted-foreground leading-relaxed">
            Have a question, feedback, or just want to say hello? We'd love to hear from you.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 shrink-0" />
              <span>hello@finvision360.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Tooothy LLC · Northbrook, IL</span>
            </div>
          </div>
        </div>

        {status === "success" ? (
          <div className="rounded-xl border bg-card p-10 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-xl">Message sent!</p>
              <p className="text-sm text-muted-foreground">Thanks for reaching out. We'll get back to you soon.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setStatus("idle"); setForm({ name: "", email: "", subject: "", message: "" }); }}
            >
              Send another message
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  rows={6}
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
          </div>
        )}
      </div>
    </PublicPageLayout>
  );
}
