import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const roles = ["Java Developer", "Python Developer", "Web Developer", "AI/ML Engineer", "Data Science", "DevOps Engineer", "General Software"];
const difficulties = ["Easy", "Medium", "Hard"];

export default function InterviewSetup() {
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Interview</h1>
        <p className="text-muted-foreground text-sm">Choose your role and difficulty to begin.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Role</CardTitle>
          <CardDescription>What position are you preparing for?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "rounded-lg border p-3 text-sm font-medium text-left transition-all",
                  role === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Difficulty</CardTitle>
          <CardDescription>Choose your comfort level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {difficulties.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "flex-1 rounded-lg border p-3 text-sm font-medium transition-all",
                  difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground text-foreground"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        size="lg"
        disabled={!role || !difficulty}
        onClick={() => navigate(`/interview/instructions?role=${encodeURIComponent(role)}&difficulty=${encodeURIComponent(difficulty)}`)}
      >
        Continue to Instructions
      </Button>
    </div>
  );
}
