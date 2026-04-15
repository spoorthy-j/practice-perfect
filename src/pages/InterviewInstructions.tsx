import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Mic, Wifi, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function InterviewInstructions() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "";
  const difficulty = searchParams.get("difficulty") || "";
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    }).catch(() => setCameraReady(false));
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const rules = [
    { icon: Camera, text: "Your camera must be on throughout the interview (presence check only, no recording)" },
    { icon: Mic, text: "Microphone access is required for audio-based questions" },
    { icon: Wifi, text: "Ensure you have a stable internet connection" },
    { icon: ShieldAlert, text: "Do not switch tabs — violations will be tracked and may auto-submit your interview" },
    { icon: AlertTriangle, text: "Right-click, copy, and paste are disabled during the interview" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Interview Instructions</h1>
        <p className="text-muted-foreground text-sm">Read carefully before starting your {difficulty} {role} interview.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Camera Preview</CardTitle></CardHeader>
        <CardContent className="flex justify-center">
          <div className="relative rounded-lg overflow-hidden border border-border w-64 h-48 bg-secondary">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {cameraReady && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[hsl(var(--success))]/20 px-2 py-0.5 text-xs text-[hsl(var(--success))]">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rules & Guidelines</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <rule.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span className="text-muted-foreground">{rule.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
        <label htmlFor="agree" className="text-sm text-muted-foreground cursor-pointer">
          I have read and agree to all the rules and guidelines above.
        </label>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!agreed || !cameraReady}
        onClick={() => navigate(`/interview/session?role=${encodeURIComponent(role)}&difficulty=${encodeURIComponent(difficulty)}`)}
      >
        Start Interview
      </Button>
    </div>
  );
}
