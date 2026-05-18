"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Quads", "Hamstrings", "Calves", "Full Body", "Cardio"];
const EQUIPMENT = ["Barbell", "Dumbbell", "Kettlebell", "Cable", "Machine", "Bodyweight", "Resistance Band", "TRX", "Other"];

export default function EditExercisePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: ex } = await supabase.from("exercise_library").select("*").eq("id", id).single();
      if (!ex || (ex.trainer_id !== null && ex.trainer_id !== user.id)) {
        router.push("/trainer/exercises");
        return;
      }
      setName(ex.name ?? "");
      setMuscleGroup(ex.muscle_group ?? "");
      setEquipment(ex.equipment ?? "");
      setInstructions(ex.instructions ?? "");
      setYoutubeUrl(ex.youtube_url ?? "");
      setExistingVideoUrl(ex.video_url ?? null);
      setLoading(false);
    }
    load();
  }, [id, router]);

  function onVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 52428800) { setError("Video must be under 50MB"); return; }
    setNewVideoFile(file);
    setNewVideoPreview(URL.createObjectURL(file));
    setRemoveVideo(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      let video_url: string | null | undefined = undefined;

      if (newVideoFile) {
        const ext = newVideoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        setUploadProgress(10);
        const { error: uploadError } = await supabase.storage
          .from("exercise-videos")
          .upload(path, newVideoFile, { contentType: newVideoFile.type, upsert: false });
        if (uploadError) { setError("Upload failed: " + uploadError.message); setSaving(false); return; }
        setUploadProgress(80);
        const { data: { publicUrl } } = supabase.storage.from("exercise-videos").getPublicUrl(path);
        video_url = publicUrl;
      } else if (removeVideo) {
        video_url = null;
      }

      setUploadProgress(90);
      const update: Record<string, unknown> = {
        name: name.trim(),
        muscle_group: muscleGroup || null,
        equipment: equipment || null,
        instructions: instructions || null,
        youtube_url: youtubeUrl.trim() || null,
      };
      if (video_url !== undefined) update.video_url = video_url;

      const { error: dbError } = await supabase.from("exercise_library").update(update).eq("id", id);
      if (dbError) { setError("Save failed: " + dbError.message); setSaving(false); return; }

      setUploadProgress(100);
      router.push(`/trainer/exercises/${id}`);
    } catch (err: unknown) {
      setError("Error: " + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  }

  if (loading) return <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D" }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/trainer/exercises/${id}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Back</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Edit Exercise</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>{error}</div>}

          {/* Video */}
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0D1827", marginBottom: 12 }}>Demo Video</div>

            {newVideoPreview ? (
              <div style={{ position: "relative" }}>
                <video src={newVideoPreview} controls style={{ width: "100%", borderRadius: 10, maxHeight: 220, background: "#000" }} />
                <button type="button" onClick={() => { setNewVideoFile(null); setNewVideoPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ) : existingVideoUrl && !removeVideo ? (
              <div style={{ position: "relative" }}>
                <video src={existingVideoUrl} controls style={{ width: "100%", borderRadius: 10, maxHeight: 220, background: "#000" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0D1827" }}>Replace Video</button>
                  <button type="button" onClick={() => setRemoveVideo(true)} style={{ padding: "10px 16px", borderRadius: 10, background: "#FEE2E2", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#DC2626" }}>Remove</button>
                </div>
              </div>
            ) : (
              <div>
                <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #E2EAF0", borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: "#F4F7FA" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎥</div>
                  <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>Tap to upload your video</div>
                  <div style={{ fontSize: 12, color: "#6B7A8D" }}>MP4, MOV, WebM · max 50MB</div>
                </div>
                {removeVideo && (
                  <button type="button" onClick={() => setRemoveVideo(false)} style={{ marginTop: 8, fontSize: 13, color: "#6B7A8D", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Keep existing video
                  </button>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={onVideoChange} style={{ display: "none" }} />
          </div>

          {/* Name */}
          <div style={cardStyle}>
            <label style={labelStyle}>Exercise Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
          </div>

          {/* Muscle group + Equipment */}
          <div style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Muscle Group</label>
                <select value={muscleGroup} onChange={e => setMuscleGroup(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Equipment</label>
                <select value={equipment} onChange={e => setEquipment(e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {EQUIPMENT.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* YouTube URL */}
          <div style={cardStyle}>
            <label style={labelStyle}>YouTube Demo URL <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(placeholder until you film your own)</span></label>
            <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." style={inputStyle} />
          </div>

          {/* Instructions */}
          <div style={cardStyle}>
            <label style={labelStyle}>Instructions / Coaching Notes</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {saving && uploadProgress > 0 && (
            <div style={{ background: "#EBF9F8", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 13, color: "#2DC4B8", marginBottom: 6 }}>{uploadProgress < 80 ? "Uploading video..." : "Saving..."}</div>
              <div style={{ background: "#E2EAF0", borderRadius: 4, height: 6 }}>
                <div style={{ background: "#2DC4B8", height: 6, borderRadius: 4, width: `${uploadProgress}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} style={{ padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };
