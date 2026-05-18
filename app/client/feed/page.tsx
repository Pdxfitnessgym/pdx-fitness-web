"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; full_name: string };
type Comment = { id: string; author_id: string; content: string; created_at: string; profiles: Profile };
type Post = {
  id: string;
  author_id: string;
  content: string | null;
  photo_url: string | null;
  video_url: string | null;
  post_type: string;
  workout_name: string | null;
  created_at: string;
  profiles: Profile;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  comments: Comment[];
};

function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#1B68B4", "#2DC4B8", "#6366F1", "#F59E0B", "#EF4444", "#10B981"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function FeedPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fetchPosts = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("posts")
      .select(`
        id, author_id, content, photo_url, video_url, post_type, workout_name, created_at,
        profiles!posts_author_id_fkey(id, full_name),
        post_likes(user_id),
        post_comments(id, author_id, content, created_at, profiles!post_comments_author_id_fkey(id, full_name))
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    const mapped: Post[] = (data ?? []).map((p: any) => ({
      id: p.id,
      author_id: p.author_id,
      content: p.content,
      photo_url: p.photo_url,
      video_url: p.video_url,
      post_type: p.post_type,
      workout_name: p.workout_name,
      created_at: p.created_at,
      profiles: p.profiles,
      like_count: p.post_likes?.length ?? 0,
      liked_by_me: (p.post_likes ?? []).some((l: any) => l.user_id === userId),
      comment_count: p.post_comments?.length ?? 0,
      comments: (p.post_comments ?? [])
        .map((c: any) => ({ ...c, profiles: c.profiles }))
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }));

    setPosts(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("id, full_name").eq("id", user.id).single().then(({ data }) => {
        if (data) { setMe(data as Profile); fetchPosts(user.id); }
      });
    });
  }, [fetchPosts]);

  function onMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 52428800) { setPostError("File must be under 50MB"); return; }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setPostError("");
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!caption.trim() && !mediaFile) { setPostError("Add a caption or photo/video"); return; }
    setPosting(true); setPostError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let photo_url: string | null = null;
    let video_url: string | null = null;

    if (mediaFile) {
      const isVideo = mediaFile.type.startsWith("video/");
      const ext = mediaFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("post-media").upload(path, mediaFile, { contentType: mediaFile.type });
      if (uploadErr) { setPostError("Upload failed"); setPosting(false); return; }
      const url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
      if (isVideo) video_url = url; else photo_url = url;
    }

    const { error: dbErr } = await supabase.from("posts").insert({
      author_id: user.id,
      content: caption.trim() || null,
      photo_url,
      video_url,
      post_type: "general",
    });
    if (dbErr) { setPostError("Failed to post"); setPosting(false); return; }

    setCaption(""); setMediaFile(null); setMediaPreview(null); setShowCreate(false);
    fetchPosts(user.id);
    setPosting(false);
  }

  async function toggleLike(postId: string, liked: boolean) {
    if (!me) return;
    const supabase = createClient();
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1) } : p));
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: me.id });
    }
  }

  async function submitComment(postId: string) {
    const content = commentInputs[postId]?.trim();
    if (!content || !me) return;
    setSubmittingComment(postId);
    const supabase = createClient();
    const { data } = await supabase.from("post_comments").insert({ post_id: postId, author_id: me.id, content }).select("id, author_id, content, created_at").single();
    if (data) {
      const newComment: Comment = { ...data, profiles: me };
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1, comments: [...p.comments, newComment] } : p));
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    }
    setSubmittingComment(null);
  }

  function toggleComments(postId: string) {
    setExpandedComments(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4" }}>Community</div>
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: "8px 18px", borderRadius: 10, background: showCreate ? "#E2EAF0" : "#2DC4B8", color: showCreate ? "#0D1827" : "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
            {showCreate ? "Cancel" : "✏️ Post"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px" }}>

        {/* Create post */}
        {showCreate && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #E2EAF0", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              {me && <Avatar name={me.full_name} />}
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Share a win, post a PR, hype someone up..."
                rows={3}
                autoFocus
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", resize: "none", fontFamily: "inherit" }}
              />
            </div>

            {mediaPreview && (
              <div style={{ position: "relative", marginBottom: 12 }}>
                {mediaFile?.type.startsWith("video/") ? (
                  <video src={mediaPreview} controls style={{ width: "100%", borderRadius: 10, maxHeight: 220, background: "#000" }} />
                ) : (
                  <img src={mediaPreview} alt="preview" style={{ width: "100%", borderRadius: 10, maxHeight: 280, objectFit: "cover" }} />
                )}
                <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            )}

            {postError && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{postError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>
                📷 Photo / Video
              </button>
              <button onClick={handlePost} disabled={posting} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#2DC4B8", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff", opacity: posting ? 0.6 : 1 }}>
                {posting ? "Posting..." : "Share"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={onMediaChange} style={{ display: "none" }} />
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#6B7A8D" }}>Loading community...</div>
        ) : posts.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827", marginBottom: 6 }}>The community feed is empty</div>
            <div style={{ color: "#6B7A8D", fontSize: 14 }}>Be the first to post! Complete a workout or share something with the crew.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                me={me}
                expandedComments={expandedComments}
                commentInputs={commentInputs}
                submittingComment={submittingComment}
                onToggleLike={toggleLike}
                onToggleComments={toggleComments}
                onCommentChange={(id, val) => setCommentInputs(prev => ({ ...prev, [id]: val }))}
                onCommentSubmit={submitComment}
                onLightbox={setLightbox}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 10, objectFit: "contain" }} />
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "8px 16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Feed", href: "/client/feed", icon: "🔥", active: true },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Progress", href: "/client/progress", icon: "📈" },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", padding: "6px 0" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: item.active ? "#2DC4B8" : "#6B7A8D", marginTop: 2, fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, me, expandedComments, commentInputs, submittingComment, onToggleLike, onToggleComments, onCommentChange, onCommentSubmit, onLightbox }: {
  post: Post; me: Profile | null; expandedComments: Set<string>; commentInputs: Record<string, string>;
  submittingComment: string | null; onToggleLike: (id: string, liked: boolean) => void;
  onToggleComments: (id: string) => void; onCommentChange: (id: string, val: string) => void;
  onCommentSubmit: (id: string) => void; onLightbox: (url: string) => void;
}) {
  const showComments = expandedComments.has(post.id);
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2EAF0", overflow: "hidden" }}>
      {/* Post header */}
      <div style={{ padding: "14px 16px 0", display: "flex", gap: 10, alignItems: "center" }}>
        <Avatar name={post.profiles?.full_name ?? "?"} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0D1827" }}>{post.profiles?.full_name ?? "Member"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>{timeAgo(post.created_at)}</span>
            {post.post_type === "workout_complete" && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#EBF9F8", color: "#2DC4B8", padding: "2px 7px", borderRadius: 20 }}>
                💪 WORKOUT DONE
              </span>
            )}
            {post.post_type === "pr" && (
              <span style={{ fontSize: 10, fontWeight: 700, background: "#FEF3C7", color: "#D97706", padding: "2px 7px", borderRadius: 20 }}>
                🏆 NEW PR
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Workout name pill */}
      {post.workout_name && (
        <div style={{ margin: "10px 16px 0", display: "inline-block", background: "#EBF4FF", color: "#1B68B4", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
          {post.workout_name}
        </div>
      )}

      {/* Content */}
      {post.content && (
        <div style={{ padding: "10px 16px 0", fontSize: 15, color: "#0D1827", lineHeight: 1.5 }}>{post.content}</div>
      )}

      {/* Media */}
      {post.photo_url && (
        <div style={{ marginTop: 10, cursor: "pointer" }} onClick={() => onLightbox(post.photo_url!)}>
          <img src={post.photo_url} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
        </div>
      )}
      {post.video_url && (
        <div style={{ marginTop: 10 }}>
          <video src={post.video_url} controls playsInline style={{ width: "100%", maxHeight: 360, display: "block", background: "#000" }} />
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 20, alignItems: "center" }}>
        <button onClick={() => onToggleLike(post.id, post.liked_by_me)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 20 }}>{post.liked_by_me ? "❤️" : "🤍"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: post.liked_by_me ? "#EF4444" : "#6B7A8D" }}>{post.like_count > 0 ? post.like_count : ""}</span>
        </button>
        <button onClick={() => onToggleComments(post.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>{post.comment_count > 0 ? post.comment_count : "Comment"}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ borderTop: "1px solid #F4F7FA", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {post.comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8 }}>
              <Avatar name={c.profiles?.full_name ?? "?"} size={28} />
              <div style={{ flex: 1, background: "#F4F7FA", borderRadius: 10, padding: "8px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0D1827", marginBottom: 2 }}>{c.profiles?.full_name ?? "Member"}</div>
                <div style={{ fontSize: 13, color: "#0D1827", lineHeight: 1.4 }}>{c.content}</div>
              </div>
            </div>
          ))}
          {/* Comment input */}
          {me && (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Avatar name={me.full_name} size={28} />
              <div style={{ flex: 1, display: "flex", gap: 6 }}>
                <input
                  value={commentInputs[post.id] ?? ""}
                  onChange={e => onCommentChange(post.id, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCommentSubmit(post.id); } }}
                  placeholder="Add a comment..."
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 20, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 13, color: "#0D1827", outline: "none" }}
                />
                <button
                  onClick={() => onCommentSubmit(post.id)}
                  disabled={submittingComment === post.id || !commentInputs[post.id]?.trim()}
                  style={{ padding: "8px 14px", borderRadius: 20, background: "#2DC4B8", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", opacity: (!commentInputs[post.id]?.trim()) ? 0.4 : 1 }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
