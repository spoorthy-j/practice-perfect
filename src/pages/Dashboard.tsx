import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BarChart3, Trophy, Target, PlayCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Interview = {
  id: string;
  role: string;
  difficulty: string;
  status: string;
  total_score: number | null;
  completed_at: string | null;
  created_at: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profile }, { data: interviewData }] = await Promise.all([
        supabase.from("profiles").select("name").eq("user_id", user.id).single(),
        supabase.from("interviews").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProfileName(profile?.name || user.email || "");
      setInterviews(interviewData || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const completed = interviews.filter((i) => i.status === "completed");
  const avgScore = completed.length ? completed.reduce((s, i) => s + (i.total_score || 0), 0) / completed.length : 0;
  const bestScore = completed.length ? Math.max(...completed.map((i) => i.total_score || 0)) : 0;

  const chartData = completed.slice(0, 10).reverse().map((i, idx) => ({
    name: `#${idx + 1}`,
    score: Math.round(i.total_score || 0),
  }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profileName || "there"}! 👋</h1>
          <p className="text-muted-foreground text-sm">Ready to ace your next interview?</p>
        </div>
        <Link to="/interview/setup">
          <Button className="gap-2"><PlayCircle className="h-4 w-4" /> Start Interview</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Interviews</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{completed.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{avgScore.toFixed(1)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Score</CardTitle>
            <Trophy className="h-4 w-4 text-[hsl(var(--warning))]" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{bestScore.toFixed(1)}%</div></CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Performance Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {completed.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Interviews</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completed.slice(0, 5).map((i) => (
                <Link key={i.id} to={`/results/${i.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary transition-colors">
                  <div>
                    <span className="font-medium">{i.role}</span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">{i.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{Math.round(i.total_score || 0)}%</span>
                    <span className="text-xs text-muted-foreground">{new Date(i.completed_at || i.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
