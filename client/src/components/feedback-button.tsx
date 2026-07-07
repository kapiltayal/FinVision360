import { useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const submitFeedback = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feedback", { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      setMessage("");
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit feedback", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) {
      toast({ title: "Please enter your feedback", variant: "destructive" });
      return;
    }
    submitFeedback.mutate();
  };

  return createPortal(
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-5 right-5 z-[9999] h-10 w-10 rounded-full shadow-md text-white border-0 hover:opacity-90 transition-opacity"
        style={{ background: "linear-gradient(135deg, #1565a8 0%, #1c91d4 55%, #42b8ed 100%)" }}
        title="Share feedback"
        data-testid="button-feedback-open"
      >
        <MessageSquarePlus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-feedback">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-[#1c91d4]" />
              Share Your Feedback
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Tell us what's working, what's not, or what feature you'd like to see next. We read every submission.
          </p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind?"
            rows={5}
            className="resize-none"
            data-testid="textarea-feedback"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-feedback-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitFeedback.isPending}
              className="text-white border-0 hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #1565a8 0%, #1c91d4 55%, #42b8ed 100%)" }}
              data-testid="button-feedback-submit"
            >
              {submitFeedback.isPending ? "Submitting…" : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    document.body
  );
}
