import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { interviewId, role, difficulty } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const prompt = `Generate exactly 7 unique interview questions for a ${role} position at ${difficulty} difficulty level.

Return a JSON array of objects with these fields:
- "question_text": the full question
- "question_type": one of "technical", "coding", or "hr"
- "time_limit_seconds": time limit (60-180 seconds based on complexity)

Requirements:
- Include at least 2 technical theory questions
- Include at least 2 coding/problem-solving questions  
- Include at least 1 HR/behavioral question
- Questions should be specific to the ${role} role
- ${difficulty} difficulty: ${difficulty === "Easy" ? "fundamentals and basic concepts" : difficulty === "Medium" ? "intermediate concepts with some depth" : "advanced topics, system design, and complex problems"}
- Make questions diverse and non-repetitive

Return ONLY valid JSON array, no markdown, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert technical interviewer. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const questions = JSON.parse(content);

    // Insert questions into database
    const rows = questions.map((q: any, i: number) => ({
      interview_id: interviewId,
      question_text: q.question_text,
      question_type: q.question_type,
      order_index: i + 1,
      time_limit_seconds: q.time_limit_seconds || 120,
    }));

    const { error: insertError } = await supabase.from("questions").insert(rows);
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
