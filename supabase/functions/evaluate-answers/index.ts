import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interviewId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get questions and responses
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("interview_id", interviewId)
      .order("order_index");

    const { data: responses } = await supabase
      .from("responses")
      .select("*")
      .eq("interview_id", interviewId);

    if (!questions || !responses) throw new Error("No data found");

    // Get interview info
    const { data: interview } = await supabase
      .from("interviews")
      .select("role, difficulty")
      .eq("id", interviewId)
      .single();

    let totalScore = 0;

    for (const question of questions) {
      const response = responses.find((r: any) => r.question_id === question.id);
      if (!response) continue;

      const prompt = `You are evaluating an interview answer for a ${interview?.role || "software"} position (${interview?.difficulty || "medium"} difficulty).

Question: ${question.question_text}
Question Type: ${question.question_type}
Candidate's Answer: ${response.user_answer}

Evaluate the answer and return a JSON object with:
- "score": number from 0-10 (0=no answer/completely wrong, 5=partial, 10=perfect)
- "feedback": constructive feedback explaining strengths and weaknesses (2-3 sentences)
- "correct_answer": the ideal/correct answer (brief but complete)

Be fair but thorough. Consider correctness, completeness, clarity, and technical depth.
Return ONLY valid JSON, no markdown.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are an expert technical interviewer and evaluator. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI error for question ${question.id}: ${aiResponse.status}`);
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "{}";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const evaluation = JSON.parse(content);
        const score = Math.min(10, Math.max(0, Number(evaluation.score) || 0));
        totalScore += score;

        await supabase
          .from("responses")
          .update({
            score,
            feedback: evaluation.feedback || "",
            correct_answer: evaluation.correct_answer || "",
          })
          .eq("id", response.id);
      } catch (parseErr) {
        console.error("Parse error for evaluation:", parseErr);
      }
    }

    // Calculate percentage and update interview
    const percentage = questions.length > 0 ? (totalScore / (questions.length * 10)) * 100 : 0;

    await supabase
      .from("interviews")
      .update({
        total_score: percentage,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interviewId);

    return new Response(JSON.stringify({ success: true, totalScore: percentage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-answers error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
