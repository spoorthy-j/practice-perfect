import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

type InterviewData = { id: string; role: string; difficulty: string; total_score: number | null; violations_count: number; completed_at: string | null };
type QuestionData = { id: string; question_text: string; question_type: string; order_index: number };
type ResponseData = { id: string; question_id: string; user_answer: string; score: number | null; feedback: string | null; correct_answer: string | null };

const recommendations: Record<string, { name: string; url: string; description: string }[]> = {
  coding: [
    { name: "LeetCode", url: "https://leetcode.com", description: "Practice coding problems" },
    { name: "HackerRank", url: "https://hackerrank.com", description: "Coding challenges and contests" },
    { name: "CodeChef", url: "https://codechef.com", description: "Competitive programming" },
  ],
  technical: [
    { name: "GeeksforGeeks", url: "https://geeksforgeeks.org", description: "Computer science concepts" },
    { name: "W3Schools", url: "https://w3schools.com", description: "Web technologies tutorials" },
    { name: "InterviewBit", url: "https://interviewbit.com", description: "Interview preparation" },
  ],
  hr: [
    { name: "Glassdoor", url: "https://glassdoor.com", description: "Interview experiences & questions" },
    { name: "Big Interview", url: "https://biginterview.com", description: "Behavioral interview practice" },
  ],
};

export default function Results() {
  const { interviewId } = useParams();
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!interviewId) return;
    const load = async () => {
      const [{ data: iv }, { data: qs }, { data: rs }] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", interviewId).single(),
        supabase.from("questions").select("*").eq("interview_id", interviewId).order("order_index"),
        supabase.from("responses").select("*").eq("interview_id", interviewId),
      ]);
      setInterview(iv);
      setQuestions(qs || []);
      setResponses(rs || []);
      setLoading(false);
    };
    load();
  }, [interviewId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!interview) return <div className="text-center py-16 text-muted-foreground">Interview not found.</div>;

  const totalScore = interview.total_score || 0;
  const grade = totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 70 ? "B" : totalScore >= 60 ? "C" : totalScore >= 50 ? "D" : "F";

  // Compute scores by type
  const typeScores: Record<string, { total: number; count: number }> = {};
  questions.forEach((q) => {
    const r = responses.find((r) => r.question_id === q.id);
    if (!typeScores[q.question_type]) typeScores[q.question_type] = { total: 0, count: 0 };
    typeScores[q.question_type].total += (r?.score || 0);
    typeScores[q.question_type].count += 1;
  });

  const radarData = Object.entries(typeScores).map(([type, data]) => ({
    type: type === "hr" ? "HR" : type.charAt(0).toUpperCase() + type.slice(1),
    score: data.count > 0 ? Math.round((data.total / data.count) * 10) : 0,
  }));

  // Weak areas
  const weakTypes = Object.entries(typeScores)
    .filter(([, d]) => d.count > 0 && (d.total / d.count) < 6)
    .map(([t]) => t);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">Interview Results</h1>
          <p className="text-muted-foreground text-sm">{interview.role} • {interview.difficulty}</p>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className={`text-5xl font-bold ${totalScore >= 70 ? "text-[hsl(var(--success))]" : totalScore >= 50 ? "text-[hsl(var(--warning))]" : "text-destructive"}`}>
              {Math.round(totalScore)}%
            </div>
            <div className="text-2xl font-bold mt-1">{grade}</div>
            <p className="text-sm text-muted-foreground mt-2">
              {interview.violations_count > 0 && `${interview.violations_count} violation(s) recorded`}
            </p>
          </CardContent>
        </Card>
        {radarData.length > 1 && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Score by Category</CardTitle></CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="type" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Question Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Question-by-Question Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => {
            const r = responses.find((r) => r.question_id === q.id);
            const score = r?.score || 0;
            return (
              <div key={q.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{score >= 7 ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <XCircle className="h-4 w-4 text-destructive" />}</span>
                    <div>
                      <p className="font-medium text-sm">Q{i + 1}: {q.question_text}</p>
                      <span className="text-xs text-muted-foreground capitalize">{q.question_type}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${score >= 7 ? "text-[hsl(var(--success))]" : score >= 5 ? "text-[hsl(var(--warning))]" : "text-destructive"}`}>
                    {score}/10
                  </span>
                </div>
                <div className="pl-6 space-y-2 text-sm">
                  <div><span className="text-muted-foreground font-medium">Your Answer:</span><p className="mt-1 text-foreground whitespace-pre-wrap">{r?.user_answer || "(no answer)"}</p></div>
                  {r?.correct_answer && <div><span className="text-[hsl(var(--success))] font-medium">Correct Answer:</span><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{r.correct_answer}</p></div>}
                  {r?.feedback && <div><span className="text-primary font-medium">Feedback:</span><p className="mt-1 text-muted-foreground">{r.feedback}</p></div>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Learning Recommendations */}
      {weakTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Recommended Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weakTypes.flatMap((type) => recommendations[type] || []).map((rec, i) => (
              <a key={i} href={rec.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary transition-colors">
                <div>
                  <p className="font-medium text-sm">{rec.name}</p>
                  <p className="text-xs text-muted-foreground">{rec.description}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link to="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
        <Link to="/interview/setup"><Button>Start New Interview</Button></Link>
      </div>
    </div>
  );
}
