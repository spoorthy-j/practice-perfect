import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

type Interview = {
  id: string; role: string; difficulty: string; status: string;
  total_score: number | null; violations_count: number;
  completed_at: string | null; created_at: string;
};

export default function InterviewHistory() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    supabase.from("interviews").select("*").eq("user_id", user.id).eq("status", "completed").order("completed_at", { ascending: false })
      .then(({ data }) => { setInterviews(data || []); setLoading(false); });
  }, [user]);

  const roles = [...new Set(interviews.map((i) => i.role))];
  const filtered = filter === "all" ? interviews : interviews.filter((i) => i.role === filter);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Interview History</h1>

      {roles.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          {roles.map((r) => (
            <Button key={r} size="sm" variant={filter === r ? "default" : "outline"} onClick={() => setFilter(r)}>{r}</Button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No completed interviews yet.</p>
            <Link to="/interview/setup"><Button className="mt-4">Start Your First Interview</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <Link key={i.id} to={`/results/${i.id}`}>
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{i.role}</p>
                    <p className="text-xs text-muted-foreground capitalize">{i.difficulty} • {i.violations_count} violation{i.violations_count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${(i.total_score || 0) >= 70 ? "text-[hsl(var(--success))]" : (i.total_score || 0) >= 50 ? "text-[hsl(var(--warning))]" : "text-destructive"}`}>
                      {Math.round(i.total_score || 0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(i.completed_at || i.created_at).toLocaleDateString()}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
