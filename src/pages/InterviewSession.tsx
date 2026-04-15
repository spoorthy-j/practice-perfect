import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Clock, Camera, ChevronRight, Loader2 } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { oneDark } from "@codemirror/theme-one-dark";

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  time_limit_seconds: number;
};

export default function InterviewSession() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "";
  const difficulty = searchParams.get("difficulty") || "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Camera setup
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {});
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Proctoring: tab switch, right-click, copy/paste
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setViolations((v) => {
          const nv = v + 1;
          toast({ title: "⚠️ Tab Switch Detected!", description: `Violation ${nv}/3. Return to your interview immediately.`, variant: "destructive" });
          return nv;
        });
      }
    };
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("copy", prevent);
    document.addEventListener("paste", prevent);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("copy", prevent);
      document.removeEventListener("paste", prevent);
    };
  }, [toast]);

  // Auto-submit on 3+ violations
  useEffect(() => {
    if (violations >= 3 && interviewId && !submitting) {
      toast({ title: "Interview Auto-Submitted", description: "Too many violations detected.", variant: "destructive" });
      submitInterview();
    }
  }, [violations]);

  // Initialize interview and generate questions
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // Create interview record
      const { data: interview, error: intErr } = await supabase
        .from("interviews")
        .insert({ user_id: user.id, role, difficulty, status: "in_progress", started_at: new Date().toISOString() })
        .select()
        .single();
      if (intErr || !interview) {
        toast({ title: "Error", description: "Failed to create interview", variant: "destructive" });
        return;
      }
      setInterviewId(interview.id);

      // Generate questions via edge function
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("generate-questions", {
        body: { interviewId: interview.id, role, difficulty },
      });
      if (fnErr) {
        toast({ title: "Error", description: "Failed to generate questions", variant: "destructive" });
        return;
      }

      // Fetch generated questions
      const { data: qs } = await supabase
        .from("questions")
        .select("*")
        .eq("interview_id", interview.id)
        .order("order_index");
      setQuestions(qs || []);
      if (qs && qs.length > 0) setTimeLeft(qs[0].time_limit_seconds);
      setLoading(false);
    };
    init();
  }, [user]);

  // Timer
  useEffect(() => {
    if (loading || questions.length === 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleNext();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIdx, loading, questions.length]);

  const handleNext = useCallback(() => {
    if (questions.length === 0) return;
    const current = questions[currentIdx];
    if (current) {
      setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    }
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setAnswer(answers[questions[nextIdx]?.id] || "");
      setTimeLeft(questions[nextIdx].time_limit_seconds);
    } else {
      submitInterview();
    }
  }, [currentIdx, answer, questions, answers]);

  const submitInterview = async () => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const finalAnswers = { ...answers };
    if (questions[currentIdx]) {
      finalAnswers[questions[currentIdx].id] = answer;
    }

    // Save all responses
    const responsesData = questions.map((q) => ({
      question_id: q.id,
      interview_id: interviewId!,
      user_answer: finalAnswers[q.id] || "(no answer)",
    }));

    await supabase.from("responses").insert(responsesData);

    // Update violations
    await supabase.from("interviews").update({ violations_count: violations }).eq("id", interviewId!);

    // Evaluate via edge function
    await supabase.functions.invoke("evaluate-answers", { body: { interviewId: interviewId! } });

    // Stop camera
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }

    navigate(`/results/${interviewId}`);
  };

  const currentQ = questions[currentIdx];
  const isCoding = currentQ?.question_type === "coding";

  const getLanguageExt = () => {
    if (role.toLowerCase().includes("python")) return [python()];
    if (role.toLowerCase().includes("java") && !role.toLowerCase().includes("javascript")) return [java()];
    return [javascript()];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Generating your interview questions with AI...</p>
      </div>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span className={`flex items-center gap-1 text-sm font-mono font-bold ${timeLeft < 30 ? "text-destructive" : "text-foreground"}`}>
            <Clock className="h-4 w-4" /> {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {violations > 0 && (
            <span className="flex items-center gap-1 text-xs text-destructive font-medium">
              <AlertTriangle className="h-3 w-3" /> {violations} violation{violations > 1 ? "s" : ""}
            </span>
          )}
          <div className="relative rounded-lg overflow-hidden border border-border w-24 h-18 bg-secondary">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 flex items-center gap-0.5 text-[10px] text-[hsl(var(--success))]">
              <Camera className="h-2.5 w-2.5" /> LIVE
            </div>
          </div>
        </div>
      </div>

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isCoding ? "bg-primary/15 text-primary" : currentQ?.question_type === "hr" ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
            }`}>
              {currentQ?.question_type === "coding" ? "Coding" : currentQ?.question_type === "hr" ? "HR/Behavioral" : "Technical"}
            </span>
          </div>
          <CardTitle className="text-lg mt-2">{currentQ?.question_text}</CardTitle>
        </CardHeader>
        <CardContent>
          {isCoding ? (
            <CodeMirror
              value={answer}
              height="300px"
              theme={oneDark}
              extensions={getLanguageExt()}
              onChange={(val) => setAnswer(val)}
              className="rounded-lg overflow-hidden border border-border"
            />
          ) : (
            <Textarea
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[200px] resize-none"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {currentIdx < questions.length - 1 ? (
            <>Next <ChevronRight className="h-4 w-4" /></>
          ) : (
            "Submit Interview"
          )}
        </Button>
      </div>
    </div>
  );
}
