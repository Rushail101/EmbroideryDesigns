import { useState, useEffect, useCallback, useRef } from "react";

// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = "https://wzwpeuwhuyvqgltrafre.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6d3BldXdodXl2cWdsdHJhZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjExMTUsImV4cCI6MjA5NDkzNzExNX0.USKnaUkHS8fVC2G0Q7_2GDVTZPmylAuxU3E0f5hLlGM";
const STORAGE_BUCKET = "embroidery-files";

// Minimal Supabase client (no SDK dependency)
const supabase = {
  from: (table) => ({
    select: async (cols = "*") => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&order=uploaded_at.desc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    insert: async (row) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    delete: (id) => ({
      eq: async (col, val) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
          method: "DELETE",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        return { error: res.ok ? null : await res.json() };
      },
    }),
  }),
  storage: {
    upload: async (path, file) => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: file,
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    getPublicUrl: (path) => ({
      data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}` },
    }),
    remove: async (paths) => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: paths }),
      });
      return { error: res.ok ? null : await res.json() };
    },
  },
};

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const FILE_TYPE_COLORS = {
  dst: { bg: "#1a3a2a", border: "#22c55e", text: "#4ade80" },
  stx: { bg: "#1a2a3a", border: "#3b82f6", text: "#60a5fa" },
  pes: { bg: "#2a1a3a", border: "#a855f7", text: "#c084fc" },
  jef: { bg: "#3a2a1a", border: "#f97316", text: "#fb923c" },
  vp3: { bg: "#3a1a1a", border: "#ef4444", text: "#f87171" },
  exp: { bg: "#1a3a3a", border: "#06b6d4", text: "#22d3ee" },
  hus: { bg: "#3a3a1a", border: "#eab308", text: "#facc15" },
  other: { bg: "#1e1e2a", border: "#6b7280", text: "#9ca3af" },
};

const ALL_TYPES = ["All Types", "dst", "stx", "pes", "jef", "vp3", "exp", "hus", "other"];

const CATEGORIES = ["Uncategorized", "Logos", "Floral", "Geometric", "Text", "Animals", "Borders", "Custom"];

function getExt(name) {
  const parts = name.split(".");
  if (parts.length < 2) return "other";
  const ext = parts.pop().toLowerCase();
  return FILE_TYPE_COLORS[ext] ? ext : "other";
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0d0d14;
    --surface: #13131f;
    --surface2: #1a1a28;
    --border: #2a2a3f;
    --accent: #7c6af7;
    --accent2: #c084fc;
    --text: #e2e2f0;
    --muted: #6b6b8a;
    --danger: #ef4444;
    --success: #22c55e;
  }

  body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; min-height: 100vh; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* NAV */
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 2rem; height: 64px;
    background: rgba(13,13,20,0.9); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
  }
  .nav-brand {
    display: flex; align-items: center; gap: 10px;
    font-size: 1.15rem; font-weight: 800; letter-spacing: -0.5px;
  }
  .nav-logo {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }
  .nav-tabs { display: flex; gap: 4px; }
  .nav-tab {
    padding: 6px 18px; border-radius: 8px; border: none; cursor: pointer;
    font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.85rem;
    transition: all 0.15s;
    background: transparent; color: var(--muted);
  }
  .nav-tab:hover { background: var(--surface2); color: var(--text); }
  .nav-tab.active { background: var(--accent); color: #fff; }

  /* MAIN PAGE */
  .page { flex: 1; padding: 2rem; max-width: 1400px; margin: 0 auto; width: 100%; }

  .page-header { margin-bottom: 2rem; }
  .page-title { font-size: 2rem; font-weight: 800; letter-spacing: -1px; }
  .page-title span { 
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .page-subtitle { color: var(--muted); font-size: 0.9rem; margin-top: 4px; font-family: 'DM Mono', monospace; }

  /* TOOLBAR */
  .toolbar {
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }
  .search-wrap {
    flex: 1; min-width: 220px; position: relative;
  }
  .search-icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: var(--muted); font-size: 15px; pointer-events: none;
  }
  .search-input {
    width: 100%; padding: 10px 12px 10px 38px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; color: var(--text);
    font-family: 'DM Mono', monospace; font-size: 0.85rem;
    outline: none; transition: border-color 0.15s;
  }
  .search-input:focus { border-color: var(--accent); }
  .search-input::placeholder { color: var(--muted); }

  .filter-select {
    padding: 10px 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 10px;
    color: var(--text); font-family: 'Syne', sans-serif; font-size: 0.85rem;
    font-weight: 600; outline: none; cursor: pointer; min-width: 140px;
    transition: border-color 0.15s;
  }
  .filter-select:focus { border-color: var(--accent); }
  .filter-select option { background: var(--surface2); }

  .view-toggle { display: flex; gap: 4px; background: var(--surface); border-radius: 10px; padding: 4px; border: 1px solid var(--border); }
  .view-btn {
    width: 34px; height: 34px; border: none; border-radius: 7px; cursor: pointer;
    background: transparent; color: var(--muted); font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .view-btn.active { background: var(--accent); color: #fff; }

  /* STATS BAR */
  .stats-bar {
    display: flex; gap: 16px; margin-bottom: 1.5rem; flex-wrap: wrap;
  }
  .stat-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 20px;
    background: var(--surface); border: 1px solid var(--border);
    font-size: 0.8rem; font-family: 'DM Mono', monospace;
  }
  .stat-dot { width: 8px; height: 8px; border-radius: 50%; }

  /* GRID */
  .files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }

  /* LIST */
  .files-list { display: flex; flex-direction: column; gap: 8px; }
  .list-header {
    display: grid; grid-template-columns: 2fr 80px 100px 120px 80px 80px;
    padding: 8px 16px; color: var(--muted);
    font-size: 0.75rem; font-family: 'DM Mono', monospace; letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* FILE CARD */
  .file-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px;
    transition: all 0.2s; cursor: default; position: relative; overflow: hidden;
    animation: fadeUp 0.3s ease both;
  }
  .file-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    opacity: 0; transition: opacity 0.2s;
  }
  .file-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(124,106,247,0.15); }
  .file-card:hover::before { opacity: 1; }

  .file-card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
  .file-ext-badge {
    padding: 4px 10px; border-radius: 6px; font-family: 'DM Mono', monospace;
    font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;
    border: 1px solid;
  }
  .file-icon { font-size: 2rem; margin-bottom: 10px; }
  .file-name {
    font-size: 0.9rem; font-weight: 700; word-break: break-all;
    margin-bottom: 6px; line-height: 1.3;
  }
  .file-meta { color: var(--muted); font-size: 0.75rem; font-family: 'DM Mono', monospace; line-height: 1.7; }
  .file-category { 
    display: inline-block; margin-top: 8px;
    padding: 2px 8px; border-radius: 4px;
    background: var(--surface2); border: 1px solid var(--border);
    font-size: 0.7rem; color: var(--muted);
  }
  .card-actions { display: flex; gap: 6px; margin-top: 14px; }
  .btn-dl, .btn-del {
    flex: 1; padding: 7px; border-radius: 8px; border: 1px solid var(--border);
    font-family: 'Syne', sans-serif; font-size: 0.78rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 5px;
  }
  .btn-dl { background: var(--surface2); color: var(--text); }
  .btn-dl:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn-del { background: transparent; color: var(--muted); }
  .btn-del:hover { background: rgba(239,68,68,0.1); border-color: var(--danger); color: var(--danger); }

  /* FILE ROW (list view) */
  .file-row {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 16px;
    display: grid; grid-template-columns: 2fr 80px 100px 120px 80px 80px;
    align-items: center; transition: all 0.15s;
    animation: fadeUp 0.2s ease both;
  }
  .file-row:hover { border-color: var(--accent); background: var(--surface2); }
  .row-name { font-size: 0.88rem; font-weight: 600; display: flex; align-items: center; gap: 8px; overflow: hidden; }
  .row-name-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-cell { font-size: 0.8rem; font-family: 'DM Mono', monospace; color: var(--muted); }
  .row-actions { display: flex; gap: 6px; justify-content: flex-end; }
  .icon-btn {
    width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; cursor: pointer; color: var(--muted); font-size: 14px;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .icon-btn:hover.dl { background: var(--accent); border-color: var(--accent); color: #fff; }
  .icon-btn:hover.del { background: rgba(239,68,68,0.1); border-color: var(--danger); color: var(--danger); }

  /* EMPTY */
  .empty {
    text-align: center; padding: 80px 20px; color: var(--muted);
  }
  .empty-icon { font-size: 4rem; margin-bottom: 16px; opacity: 0.4; }
  .empty-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 6px; color: var(--text); }
  .empty-sub { font-size: 0.85rem; font-family: 'DM Mono', monospace; }

  /* UPLOAD PAGE */
  .upload-page { max-width: 720px; margin: 0 auto; width: 100%; padding: 2rem; }

  .dropzone {
    border: 2px dashed var(--border); border-radius: 20px;
    padding: 60px 40px; text-align: center; cursor: pointer;
    transition: all 0.2s; background: var(--surface); position: relative;
  }
  .dropzone.dragging { border-color: var(--accent); background: rgba(124,106,247,0.06); }
  .dropzone:hover { border-color: var(--accent); }
  .dropzone-icon { font-size: 3.5rem; margin-bottom: 16px; }
  .dropzone-title { font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; }
  .dropzone-sub { color: var(--muted); font-size: 0.85rem; font-family: 'DM Mono', monospace; line-height: 1.6; }
  .dropzone-formats {
    display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 16px;
  }
  .format-pill {
    padding: 3px 10px; border-radius: 20px; font-size: 0.72rem;
    font-family: 'DM Mono', monospace; font-weight: 500; text-transform: uppercase;
    border: 1px solid; letter-spacing: 0.5px;
  }
  .file-input-hidden { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }

  /* STAGED FILES */
  .staged-section { margin-top: 24px; }
  .staged-title { font-size: 0.85rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-family: 'DM Mono', monospace; }

  .staged-file {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px; margin-bottom: 10px;
  }
  .staged-file-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .staged-file-info { flex: 1; overflow: hidden; }
  .staged-file-name { font-size: 0.9rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .staged-file-size { font-size: 0.75rem; color: var(--muted); font-family: 'DM Mono', monospace; }
  .staged-file-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field-group { display: flex; flex-direction: column; gap: 5px; }
  .field-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); font-family: 'DM Mono', monospace; }
  .field-input, .field-select {
    padding: 8px 10px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text); font-family: 'Syne', sans-serif; font-size: 0.83rem;
    outline: none; transition: border-color 0.15s;
  }
  .field-input:focus, .field-select:focus { border-color: var(--accent); }
  .field-select option { background: var(--surface2); }
  .remove-staged {
    width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; cursor: pointer; color: var(--muted); font-size: 16px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: all 0.15s;
  }
  .remove-staged:hover { background: rgba(239,68,68,0.1); border-color: var(--danger); color: var(--danger); }

  /* PROGRESS */
  .progress-bar-wrap { margin-top: 6px; height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
  .progress-bar { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; transition: width 0.3s; }

  /* UPLOAD BTN */
  .upload-actions { margin-top: 24px; display: flex; gap: 12px; }
  .btn-primary {
    flex: 1; padding: 14px; border: none; border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.95rem;
    cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(124,106,247,0.4); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-secondary {
    padding: 14px 20px; border: 1px solid var(--border); border-radius: 12px;
    background: var(--surface); color: var(--text); font-family: 'Syne', sans-serif;
    font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.15s;
  }
  .btn-secondary:hover { border-color: var(--muted); }

  /* TOAST */
  .toast-wrap { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 999; }
  .toast {
    padding: 12px 18px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;
    display: flex; align-items: center; gap: 8px; min-width: 260px;
    animation: slideIn 0.25s ease;
    border: 1px solid;
  }
  .toast.success { background: rgba(34,197,94,0.15); border-color: var(--success); color: var(--success); }
  .toast.error { background: rgba(239,68,68,0.15); border-color: var(--danger); color: var(--danger); }

  /* LOADING */
  .loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
  .spinner {
    width: 36px; height: 36px; border: 3px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* CONFIRM MODAL */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    z-index: 200; display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.15s ease;
  }
  .modal {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 16px; padding: 28px; max-width: 380px; width: 90%;
    animation: scaleIn 0.2s ease;
  }
  .modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  .modal-body { color: var(--muted); font-size: 0.85rem; margin-bottom: 20px; line-height: 1.5; font-family: 'DM Mono', monospace; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .btn-cancel { padding: 9px 18px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text); font-family: 'Syne', sans-serif; font-weight: 600; cursor: pointer; }
  .btn-confirm-del { padding: 9px 18px; border: none; border-radius: 8px; background: var(--danger); color: #fff; font-family: 'Syne', sans-serif; font-weight: 700; cursor: pointer; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────
function ConfirmModal({ file, onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Delete File?</div>
        <div className="modal-body">
          This will permanently delete<br />
          <strong style={{ color: "var(--text)" }}>{file?.original_name}</strong><br />
          from storage and the database. This cannot be undone.
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-confirm-del" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── FILE CARD (grid) ─────────────────────────────────────────────────────────
function FileCard({ file, onDelete, onDownload }) {
  const ext = getExt(file.original_name || "");
  const colors = FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.other;
  return (
    <div className="file-card">
      <div className="file-card-top">
        <span className="file-ext-badge" style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}>
          .{ext}
        </span>
      </div>
      <div className="file-icon">🪡</div>
      <div className="file-name">{file.original_name}</div>
      <div className="file-meta">
        <div>{formatBytes(file.size_bytes)}</div>
        <div>{formatDate(file.uploaded_at)}</div>
      </div>
      {file.category && file.category !== "Uncategorized" && (
        <span className="file-category">{file.category}</span>
      )}
      {file.notes && (
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.notes}
        </div>
      )}
      <div className="card-actions">
        <button className="btn-dl" onClick={() => onDownload(file)}>↓ Download</button>
        <button className="btn-del" onClick={() => onDelete(file)}>✕</button>
      </div>
    </div>
  );
}

// ─── FILE ROW (list) ──────────────────────────────────────────────────────────
function FileRow({ file, onDelete, onDownload }) {
  const ext = getExt(file.original_name || "");
  const colors = FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.other;
  return (
    <div className="file-row">
      <div className="row-name">
        <span className="file-ext-badge" style={{ background: colors.bg, borderColor: colors.border, color: colors.text, fontSize: "0.65rem", padding: "2px 7px" }}>
          .{ext}
        </span>
        <span className="row-name-text">{file.original_name}</span>
      </div>
      <div className="row-cell">{formatBytes(file.size_bytes)}</div>
      <div className="row-cell">{file.category || "—"}</div>
      <div className="row-cell" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.notes || "—"}</div>
      <div className="row-cell">{formatDate(file.uploaded_at)}</div>
      <div className="row-actions">
        <button className="icon-btn dl" title="Download" onClick={() => onDownload(file)}>↓</button>
        <button className="icon-btn del" title="Delete" onClick={() => onDelete(file)}>✕</button>
      </div>
    </div>
  );
}

// ─── MAIN FILES PAGE ─────────────────────────────────────────────────────────
function FilesPage({ addToast }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [view, setView] = useState("grid"); // grid | list
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("embroidery_files").select("*");
    if (error) addToast("Failed to load files", "error");
    else setFiles(data || []);
    setLoading(false);
  }, [addToast]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const filtered = files.filter((f) => {
    const matchSearch = (f.original_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (f.notes || "").toLowerCase().includes(search.toLowerCase()) ||
      (f.category || "").toLowerCase().includes(search.toLowerCase());
    const ext = getExt(f.original_name || "");
    const matchType = typeFilter === "All Types" || ext === typeFilter;
    return matchSearch && matchType;
  });

  const handleDownload = (file) => {
    const { data } = supabase.storage.getPublicUrl(file.storage_path);
    window.open(data.publicUrl, "_blank");
  };

  const handleDelete = async () => {
    const file = deleteTarget;
    setDeleteTarget(null);
    const { error: storageErr } = await supabase.storage.remove([file.storage_path]);
    if (storageErr) { addToast("Storage delete failed", "error"); return; }
    const { error: dbErr } = await supabase.from("embroidery_files").delete(file.id).eq("id", file.id);
    if (dbErr) { addToast("DB delete failed", "error"); return; }
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    addToast(`Deleted ${file.original_name}`, "success");
  };

  // Stats
  const typeCounts = {};
  files.forEach((f) => {
    const ext = getExt(f.original_name || "");
    typeCounts[ext] = (typeCounts[ext] || 0) + 1;
  });

  return (
    <div className="page">
      {deleteTarget && (
        <ConfirmModal file={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}

      <div className="page-header">
        <div className="page-title">Embroidery <span>Design Library</span></div>
        <div className="page-subtitle">
          {files.length} file{files.length !== 1 ? "s" : ""} stored · Needle Point
        </div>
      </div>

      {/* Stats chips */}
      {!loading && files.length > 0 && (
        <div className="stats-bar">
          {Object.entries(typeCounts).slice(0, 6).map(([ext, count]) => {
            const colors = FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.other;
            return (
              <div className="stat-chip" key={ext}>
                <div className="stat-dot" style={{ background: colors.border }} />
                <span style={{ color: "var(--text)", fontWeight: 600 }}>.{ext}</span>
                <span style={{ color: "var(--muted)" }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            placeholder="Search by name, category, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{t === "All Types" ? "All Types" : `.${t.toUpperCase()}`}</option>
          ))}
        </select>
        <div className="view-toggle">
          <button className={`view-btn ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")} title="Grid view">⊞</button>
          <button className={`view-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")} title="List view">☰</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🪡</div>
          <div className="empty-title">{files.length === 0 ? "No files yet" : "No results found"}</div>
          <div className="empty-sub">
            {files.length === 0 ? "Upload your first embroidery design to get started." : "Try a different search or filter."}
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="files-grid">
          {filtered.map((f) => (
            <FileCard key={f.id} file={f} onDelete={setDeleteTarget} onDownload={handleDownload} />
          ))}
        </div>
      ) : (
        <div className="files-list">
          <div className="list-header">
            <span>File Name</span><span>Size</span><span>Category</span><span>Notes</span><span>Date</span><span></span>
          </div>
          {filtered.map((f) => (
            <FileRow key={f.id} file={f} onDelete={setDeleteTarget} onDownload={handleDownload} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── UPLOAD PAGE ──────────────────────────────────────────────────────────────
function UploadPage({ addToast, onUploadSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState([]); // { file, category, notes, progress, status }
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList).map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      category: "Uncategorized",
      notes: "",
      progress: 0,
      status: "idle",
    }));
    setStaged((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const updateStaged = (id, key, val) => {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: val } : s)));
  };

  const removeStaged = (id) => setStaged((prev) => prev.filter((s) => s.id !== id));

  const handleUpload = async () => {
    if (staged.length === 0 || uploading) return;
    setUploading(true);

    for (const item of staged) {
      const { file, category, notes, id } = item;
      updateStaged(id, "status", "uploading");

      // Unique storage path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${timestamp}_${safeName}`;

      // Upload to Supabase Storage
      const { error: storageErr } = await supabase.storage.upload(path, file);
      if (storageErr) {
        updateStaged(id, "status", "error");
        addToast(`Failed to upload ${file.name}`, "error");
        continue;
      }

      updateStaged(id, "progress", 60);

      // Insert metadata row
      const { error: dbErr } = await supabase.from("embroidery_files").insert({
        original_name: file.name,
        file_type: file.name.split(".").pop().toLowerCase(),
        size_bytes: file.size,
        storage_path: path,
        category,
        notes,
      });

      if (dbErr) {
        updateStaged(id, "status", "error");
        addToast(`DB error for ${file.name}`, "error");
      } else {
        updateStaged(id, "status", "done");
        updateStaged(id, "progress", 100);
        addToast(`Uploaded ${file.name}`, "success");
      }
    }

    setUploading(false);
    setTimeout(() => {
      setStaged([]);
      onUploadSuccess();
    }, 1200);
  };

  return (
    <div className="upload-page">
      <div className="page-header">
        <div className="page-title">Upload <span>Designs</span></div>
        <div className="page-subtitle">Any embroidery format accepted · DST, STX, PES, JEF, VP3…</div>
      </div>

      {/* Drop Zone */}
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="file-input-hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <div className="dropzone-icon">{dragging ? "📂" : "🗂️"}</div>
        <div className="dropzone-title">{dragging ? "Drop it!" : "Drag & drop files here"}</div>
        <div className="dropzone-sub">
          or click to browse your computer<br />
          Any file type is accepted — no restrictions
        </div>
        <div className="dropzone-formats">
          {["dst", "stx", "pes", "jef", "vp3", "exp", "hus"].map((ext) => {
            const colors = FILE_TYPE_COLORS[ext];
            return (
              <span key={ext} className="format-pill" style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}>
                .{ext}
              </span>
            );
          })}
          <span className="format-pill" style={{ background: "var(--surface2)", borderColor: "var(--border)", color: "var(--muted)" }}>
            + more
          </span>
        </div>
      </div>

      {/* Staged files */}
      {staged.length > 0 && (
        <div className="staged-section">
          <div className="staged-title">{staged.length} file{staged.length !== 1 ? "s" : ""} queued</div>
          {staged.map((item) => {
            const ext = getExt(item.file.name);
            const colors = FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.other;
            const isDone = item.status === "done";
            const isErr = item.status === "error";
            return (
              <div className="staged-file" key={item.id} style={{ borderColor: isDone ? "var(--success)" : isErr ? "var(--danger)" : "var(--border)" }}>
                <div className="staged-file-top">
                  <span className="file-ext-badge" style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}>
                    .{ext}
                  </span>
                  <div className="staged-file-info">
                    <div className="staged-file-name">{item.file.name}</div>
                    <div className="staged-file-size">{formatBytes(item.file.size)}</div>
                  </div>
                  {!uploading && (
                    <button className="remove-staged" onClick={() => removeStaged(item.id)}>✕</button>
                  )}
                  {isDone && <span style={{ color: "var(--success)", fontSize: "18px" }}>✓</span>}
                  {isErr && <span style={{ color: "var(--danger)", fontSize: "18px" }}>✕</span>}
                </div>

                {item.status === "uploading" && (
                  <div className="progress-bar-wrap">
                    <div className="progress-bar" style={{ width: `${item.progress}%` }} />
                  </div>
                )}

                {item.status === "idle" && (
                  <div className="staged-file-fields">
                    <div className="field-group">
                      <label className="field-label">Category</label>
                      <select
                        className="field-select"
                        value={item.category}
                        onChange={(e) => updateStaged(item.id, "category", e.target.value)}
                      >
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Notes</label>
                      <input
                        className="field-input"
                        placeholder="Optional note…"
                        value={item.notes}
                        onChange={(e) => updateStaged(item.id, "notes", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="upload-actions">
            <button className="btn-secondary" onClick={() => setStaged([])} disabled={uploading}>Clear All</button>
            <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Uploading…</> : `↑ Upload ${staged.length} File${staged.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("library"); // library | upload
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  const handleUploadSuccess = () => setPage("library");

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-logo">🪡</div>
            Needle Point · Files
          </div>
          <div className="nav-tabs">
            <button className={`nav-tab ${page === "library" ? "active" : ""}`} onClick={() => setPage("library")}>
              Library
            </button>
            <button className={`nav-tab ${page === "upload" ? "active" : ""}`} onClick={() => setPage("upload")}>
              + Upload
            </button>
          </div>
        </nav>

        {page === "library" ? (
          <FilesPage addToast={addToast} />
        ) : (
          <UploadPage addToast={addToast} onUploadSuccess={handleUploadSuccess} />
        )}

        <Toast toasts={toasts} />
      </div>
    </>
  );
}
