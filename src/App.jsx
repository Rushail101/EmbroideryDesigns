import { useState, useEffect, useCallback, useRef } from "react";
// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = "https://wzwpeuwhuyvqgltrafre.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6d3BldXdodXl2cWdsdHJhZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjExMTUsImV4cCI6MjA5NDkzNzExNX0.USKnaUkHS8fVC2G0Q7_2GDVTZPmylAuxU3E0f5hLlGM";
const STORAGE_BUCKET = "embroidery-files";

// IMPORTANT:
// Your table is inside schema:
// embroidery.embroidery_files
//
// So ALWAYS use:
// "embroidery/embroidery_files"
//
// REST FORMAT:
// /rest/v1/{schema}/{table}

// ─────────────────────────────────────────────────────────────
// MINIMAL SUPABASE CLIENT
// ─────────────────────────────────────────────────────────────
const supabase = {
  from: (table) => ({
    select: async (cols = "*", order = "") => {
      const query = new URLSearchParams();

      query.append("select", cols);

      if (order) {
        query.append("order", order);
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${query.toString()}`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const data = await res.json();

      return {
        data,
        error: res.ok ? null : data,
      };
    },

    insert: async (row) => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(row),
        }
      );

      const data = await res.json();

      return {
        data,
        error: res.ok ? null : data,
      };
    },

    delete: () => ({
      eq: async (col, val) => {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(
            val
          )}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );

        return {
          error: res.ok ? null : await res.json(),
        };
      },
    }),
  }),

  storage: {
    upload: async (path, file) => {
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: file,
        }
      );

      const data = await res.json();

      return {
        data,
        error: res.ok ? null : data,
      };
    },

    getPublicUrl: (path) => ({
      data: {
        publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`,
      },
    }),

    remove: async (paths) => {
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefixes: paths,
          }),
        }
      );

      return {
        error: res.ok ? null : await res.json(),
      };
    },
  },
};

// ─────────────────────────────────────────────────────────────
// TABLE REFERENCES
// ─────────────────────────────────────────────────────────────

// EMBROIDERY APP
const TABLE_EMBROIDERY_FILES = "embroidery/embroidery_files";

// OTHER APPS EXAMPLES
const TABLE_COSTING_HISTORY = "costing/costing_history";

const TABLE_ORDERS = "apparel_factory/orders";
const TABLE_PRODUCTS = "apparel_factory/products";
const TABLE_BRANDS = "apparel_factory/brands";

const TABLE_INVOICES = "accounts_erp/invoices";
const TABLE_PARTIES = "accounts_erp/parties";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
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

const ALL_TYPES = [
  "All Types",
  "dst",
  "stx",
  "pes",
  "jef",
  "vp3",
  "exp",
  "hus",
  "other",
];

const CATEGORIES = [
  "Uncategorized",
  "Logos",
  "Floral",
  "Geometric",
  "Text",
  "Animals",
  "Borders",
  "Custom",
];

function getExt(name) {
  const parts = name.split(".");
  if (parts.length < 2) return "other";

  const ext = parts.pop().toLowerCase();

  return FILE_TYPE_COLORS[ext] ? ext : "other";
}

function formatBytes(bytes) {
  if (!bytes) return "—";

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState("All Types");

  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef();

  // ─────────────────────────────────────────────────────────
  // FETCH FILES
  // ─────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from(TABLE_EMBROIDERY_FILES)
      .select("*", "uploaded_at.desc");

    if (error) {
      console.error(error);
      alert("Failed to load files");
    } else {
      setFiles(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ─────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────
  const uploadFiles = async (e) => {
    const selected = Array.from(e.target.files || []);

    if (selected.length === 0) return;

    setUploading(true);

    for (const file of selected) {
      try {
        const timestamp = Date.now();

        const safeName = file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const path = `${timestamp}_${safeName}`;

        // STORAGE
        const { error: uploadError } =
          await supabase.storage.upload(path, file);

        if (uploadError) {
          console.error(uploadError);
          alert(`Failed upload: ${file.name}`);
          continue;
        }

        // DATABASE
        const { error: insertError } = await supabase
          .from(TABLE_EMBROIDERY_FILES)
          .insert({
            original_name: file.name,
            file_type: getExt(file.name),
            size_bytes: file.size,
            storage_path: path,
            category: "Uncategorized",
            notes: "",
          });

        if (insertError) {
          console.error(insertError);
          alert(`DB insert failed: ${file.name}`);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setUploading(false);

    fetchFiles();
  };

  // ─────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────
  const deleteFile = async (file) => {
    const ok = window.confirm(
      `Delete ${file.original_name}?`
    );

    if (!ok) return;

    // STORAGE
    const { error: storageErr } =
      await supabase.storage.remove([
        file.storage_path,
      ]);

    if (storageErr) {
      console.error(storageErr);
      alert("Storage delete failed");
      return;
    }

    // DATABASE
    const { error: dbErr } = await supabase
      .from(TABLE_EMBROIDERY_FILES)
      .delete()
      .eq("id", file.id);

    if (dbErr) {
      console.error(dbErr);
      alert("Database delete failed");
      return;
    }

    fetchFiles();
  };

  // ─────────────────────────────────────────────────────────
  // DOWNLOAD
  // ─────────────────────────────────────────────────────────
  const downloadFile = (file) => {
    const { data } = supabase.storage.getPublicUrl(
      file.storage_path
    );

    window.open(data.publicUrl, "_blank");
  };

  // ─────────────────────────────────────────────────────────
  // FILTERED
  // ─────────────────────────────────────────────────────────
  const filtered = files.filter((f) => {
    const searchMatch =
      f.original_name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      f.category
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      f.notes
        ?.toLowerCase()
        .includes(search.toLowerCase());

    const ext = getExt(f.original_name || "");

    const typeMatch =
      typeFilter === "All Types" ||
      ext === typeFilter;

    return searchMatch && typeMatch;
  });

  // ─────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "#0f0f14",
        color: "white",
        minHeight: "100vh",
        padding: 32,
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          marginBottom: 20,
          fontSize: 34,
        }}
      >
        Embroidery Design Library
      </h1>

      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #333",
            background: "#181820",
            color: "white",
            minWidth: 240,
          }}
        />

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value)
          }
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #333",
            background: "#181820",
            color: "white",
          }}
        >
          {ALL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <button
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={uploading}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: "#7c6af7",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={uploadFiles}
        />
      </div>

      {/* LOADING */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill,minmax(260px,1fr))",
            gap: 18,
          }}
        >
          {filtered.map((file) => {
            const ext = getExt(
              file.original_name || ""
            );

            const colors =
              FILE_TYPE_COLORS[ext] ||
              FILE_TYPE_COLORS.other;

            return (
              <div
                key={file.id}
                style={{
                  background: "#181820",
                  border: "1px solid #2d2d3a",
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                    marginBottom: 14,
                    textTransform: "uppercase",
                    fontSize: 12,
                  }}
                >
                  .{ext}
                </div>

                <h3
                  style={{
                    fontSize: 16,
                    marginBottom: 10,
                    wordBreak: "break-word",
                  }}
                >
                  {file.original_name}
                </h3>

                <div
                  style={{
                    color: "#aaa",
                    fontSize: 13,
                    marginBottom: 14,
                    lineHeight: 1.7,
                  }}
                >
                  <div>
                    {formatBytes(file.size_bytes)}
                  </div>

                  <div>
                    {formatDate(file.uploaded_at)}
                  </div>

                  <div>
                    {file.category || "—"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() =>
                      downloadFile(file)
                    }
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 10,
                      border: "none",
                      background: "#7c6af7",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Download
                  </button>

                  <button
                    onClick={() =>
                      deleteFile(file)
                    }
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #444",
                      background: "transparent",
                      color: "#ff6b6b",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
