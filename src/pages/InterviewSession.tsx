import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Clock, Camera, ChevronRight, Loader2, Maximize, Shield } from "lucide-react";
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // Fullscreen may be blocked by browser
      }
    };
    enterFullscreen();

    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);

    // Disable scrolling on body
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.body.style.overflow = "";
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Camera setup with better constraints for face visibility
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        toast({ title: "Camera Error", description: "Could not access camera. Proctoring requires camera access.", variant: "destructive" });
      });
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
          toast({
            title: "⚠️ Tab Switch Detected!",
            description: `Violation ${nv}/3. Return to your interview immediately.`,
            variant: "destructive",
          });
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

      const { error: fnErr } = await supabase.functions.invoke("generate-questions", {
        body: { interviewId: interview.id, role, difficulty },
      });
      if (fnErr) {
        toast({ title: "Error", description: "Failed to generate questions", variant: "destructive" });
        return;
      }

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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

    const responsesData = questions.map((q) => ({
      question_id: q.id,
      interview_id: interviewId!,
      user_answer: finalAnswers[q.id] || "(no answer)",
    }));

    await supabase.from("responses").insert(responsesData);
    await supabase.from("interviews").update({ violations_count: violations }).eq("id", interviewId!);
    await supabase.functions.invoke("evaluate-answers", { body: { interviewId: interviewId! } });

    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
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

  const progressPercent = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-lg">Generating your interview questions with AI...</p>
        <p className="text-muted-foreground/60 text-sm">Role: {role} • Difficulty: {difficulty}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden select-none">
      {/* Progress bar */}
      <div className="h-1 w-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">MockMaster AI</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-muted-foreground">
            Question {currentIdx + 1}/{questions.length}
          </span>
          <span
            className={`flex items-center gap-1.5 text-sm font-mono font-bold px-2.5 py-1 rounded-md ${
              timeLeft < 30
                ? "text-destructive bg-destructive/10 animate-pulse"
                : "text-foreground bg-secondary"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {violations > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-destructive font-semibold bg-destructive/10 px-2.5 py-1 rounded-md">
              <AlertTriangle className="h-3.5 w-3.5" />
              {violations}/3 violations
            </span>
          )}

          {!isFullscreen && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => document.documentElement.requestFullscreen().catch(() => {})}
            >
              <Maximize className="h-3.5 w-3.5" /> Fullscreen
            </Button>
          )}

          {/* Camera preview */}
          <div className="relative w-32 h-24 rounded-lg overflow-hidden border-2 border-primary/30 bg-black shadow-lg shadow-primary/5 flex-shrink-0">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-white tracking-wider">
                <Camera className="h-2.5 w-2.5 inline mr-0.5" />
                LIVE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl mx-auto w-full">
          {/* Question type badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isCoding
                  ? "bg-primary/15 text-primary"
                  : currentQ?.question_type === "hr"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-emerald-500/15 text-emerald-500"
              }`}
            >
              {currentQ?.question_type === "coding"
                ? "💻 Coding"
                : currentQ?.question_type === "hr"
                ? "🤝 HR/Behavioral"
                : "🔧 Technical"}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.ceil(currentQ?.time_limit_seconds / 60)} min time limit
            </span>
          </div>

          {/* Question text */}
          <h2 className="text-xl font-semibold text-foreground mb-5 leading-relaxed">
            {currentQ?.question_text}
          </h2>

          {/* Answer area */}
          {isCoding ? (
            <CodeMirror
              value={answer}
              height="350px"
              theme={oneDark}
              extensions={getLanguageExt()}
              onChange={(val) => setAnswer(val)}
              className="rounded-lg overflow-hidden border border-border shadow-sm"
            />
          ) : (
            <Textarea
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[250px] resize-none text-base leading-relaxed"
            />
          )}
        </div>

        {/* Bottom action bar */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {role} • {difficulty} difficulty
          </span>
          <Button onClick={handleNext} disabled={submitting} className="gap-2 px-6">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {currentIdx < questions.length - 1 ? (
              <>
                Next <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              "Submit Interview"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
