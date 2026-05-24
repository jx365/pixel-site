const TOKEN_KEY = "pixel_art_token";
const AUTH_MODE_KEY = "pixel_art_auth_mode";
const GUEST_MODE = "guest";
const USER_MODE = "user";
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
const DEFAULT_BACKEND_HINT = API_BASE_URL || "http://127.0.0.1:8000";

function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

function withApiOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return apiUrl(normalizedPath);
}

function toFriendlyNetworkError(err: unknown): Error {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed")
    ) {
      return new Error(`无法连接到服务，请确认后端已启动（${DEFAULT_BACKEND_HINT}）并刷新页面。`);
    }
    return err;
  }
  return new Error("请求失败，请稍后重试。");
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  if (!text) return fallback;
  try {
    const data = JSON.parse(text);
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return `参数校验失败：${JSON.stringify(detail)}`;
    if (detail) return JSON.stringify(detail);
  } catch {
    // ignore json parse errors and use raw text
  }
  return text || fallback;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setAuthMode(mode: typeof GUEST_MODE | typeof USER_MODE) {
  localStorage.setItem(AUTH_MODE_KEY, mode);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthState() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_MODE_KEY);
}

export function enterGuestMode() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(AUTH_MODE_KEY, GUEST_MODE);
}

export function isGuestMode(): boolean {
  return localStorage.getItem(AUTH_MODE_KEY) === GUEST_MODE;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...options, headers });
  } catch (err) {
    throw toFriendlyNetworkError(err);
  }
  if (res.status === 401) {
    const wasGuest = isGuestMode();
    clearToken();
    if (!wasGuest) {
      window.location.href = "/login";
    }
    throw new Error("当前模式无权限访问该接口");
  }
  if (!res.ok) {
    const detail = await readErrorMessage(res, `请求失败（${res.status}）`);
    throw new Error(detail);
  }
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }
  return res as unknown as T;
}

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  auth_provider: string;
  is_guest: boolean;
  created_at: string;
}

export interface PaletteColor {
  sort: number;
  label: string;
  r: number;
  g: number;
  b: number;
}

export interface Palette {
  id: number;
  name: string;
  colors: PaletteColor[];
  created_at: string;
}

export interface ColorCandidate {
  r: number;
  g: number;
  b: number;
  count: number;
}

export type ExtractQuality = "conservative" | "balanced" | "high_fidelity";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PreprocessParams {
  enabled: boolean;
  posterize_levels: number;
  blur_radius: number;
  edge_strength: number;
}

export interface RenderParams {
  color_space: string;
  render_mode: string;
  dither: string;
  saturation: number;
  gamma: number;
  contrast: number;
  smart_cutout: boolean;
  preprocess?: PreprocessParams | null;
}

export interface Project {
  id: number;
  name: string;
  palette_id: number;
  source_image_url: string;
  canvas_w: number;
  canvas_h: number;
  crop: CropRect | null;
  preprocess: PreprocessParams | null;
  created_at: string;
}

export interface RenderResult {
  id: number;
  project_id: number;
  params: RenderParams;
  thumb_url: string | null;
  preview_url: string | null;
  canvas_w: number;
  canvas_h: number;
  created_at: string;
}

export interface Work {
  id: number;
  user_id: number;
  author_name: string;
  title: string;
  description: string | null;
  image_url: string;
  like_count: number;
  comment_count: number;
  status: string;
  removed_reason: string | null;
  created_at: string;
  is_liked: boolean;
}

export interface WorkComment {
  id: number;
  work_id: number;
  user_id: number;
  author_name: string;
  content: string;
  status: string;
  removed_reason: string | null;
  created_at: string;
}

export interface Notice {
  id: number;
  category: string;
  title: string;
  content: string;
  related_type: string | null;
  related_id: number | null;
  created_at: string;
  is_read: boolean;
}

export interface LeaderboardItem {
  user_id: number;
  display_name: string;
  likes: number;
}

export interface Announcement {
  id: number;
  admin_user_id: number;
  title: string;
  content: string;
  created_at: string;
}

export interface ModerationLogItem {
  id: number;
  admin_user_id: number;
  target_user_id: number;
  target_type: string;
  target_id: number;
  action: string;
  reason: string;
  created_at: string;
}

function normalizeWork(work: Work): Work {
  return {
    ...work,
    image_url: withApiOrigin(work.image_url) ?? work.image_url,
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    source_image_url: withApiOrigin(project.source_image_url) ?? project.source_image_url,
  };
}

function normalizeRenderResult(result: RenderResult): RenderResult {
  return {
    ...result,
    thumb_url: withApiOrigin(result.thumb_url),
    preview_url: withApiOrigin(result.preview_url),
  };
}

export const api = {
  startGuestSession: async () => {
    const data = await request<{ access_token: string; token_type: string; user: User }>("/api/auth/guest", {
      method: "POST",
    });
    setToken(data.access_token);
    setAuthMode(GUEST_MODE);
    return data.user;
  },

  loginWeiboPlaceholder: async () => {
    const data = await request<{ access_token: string; token_type: string; user: User }>("/api/auth/weibo", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setToken(data.access_token);
    setAuthMode(USER_MODE);
    return data.user;
  },

  me: () => request<User>("/api/auth/me"),

  updateProfile: (displayName: string) =>
    request<User>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ display_name: displayName }),
    }),

  upgradeAdmin: (inviteCode: string) =>
    request<User>("/api/auth/upgrade-admin", {
      method: "POST",
      body: JSON.stringify({ invite_code: inviteCode }),
    }),

  extractColors: async (files: File[], quality: ExtractQuality = "balanced") => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("quality", quality);
    const token = getToken();
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/palettes/extract"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
    } catch (err) {
      throw toFriendlyNetworkError(err);
    }
    if (!res.ok) {
      const detail = await readErrorMessage(
        res,
        "提取失败，请确认后端已重启并重试。"
      );
      throw new Error(detail);
    }
    return res.json() as Promise<{ candidates: ColorCandidate[] }>;
  },

  listPalettes: () => request<Palette[]>("/api/palettes"),
  createPalette: (data: { name: string; colors: PaletteColor[] }) =>
    request<Palette>("/api/palettes", { method: "POST", body: JSON.stringify(data) }),
  deletePalette: (id: number) =>
    request<{ ok: boolean }>(`/api/palettes/${id}`, { method: "DELETE" }),

  listProjects: async () => {
    const projects = await request<Project[]>("/api/projects");
    return projects.map(normalizeProject);
  },

  createProject: (fd: FormData) => {
    const token = getToken();
    return fetch(apiUrl("/api/projects"), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    })
      .catch((err) => {
        throw toFriendlyNetworkError(err);
      })
      .then(async (res) => {
      if (!res.ok) {
        const detail = await readErrorMessage(res, "创建失败");
        throw new Error(detail);
      }
      const project = (await res.json()) as Project;
      return normalizeProject(project);
    });
  },

  updateProject: async (id: number, data: Record<string, unknown>) => {
    const project = await request<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return normalizeProject(project);
  },

  preprocessPreview: async (projectId: number, params: PreprocessParams) => {
    const data = await request<{ preview_url: string }>(`/api/projects/${projectId}/preprocess`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    return {
      preview_url: withApiOrigin(data.preview_url) ?? data.preview_url,
    };
  },

  render: async (projectId: number, params: RenderParams) => {
    const result = await request<RenderResult>(`/api/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify({ params }),
    });
    return normalizeRenderResult(result);
  },

  batch: async (projectId: number, body: { base_params: RenderParams; param_grid: Record<string, { values: unknown[] }> }) => {
    const data = await request<{ id: number; project_id: number; results: RenderResult[] }>(
      `/api/projects/${projectId}/batch`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return {
      ...data,
      results: data.results.map(normalizeRenderResult),
    };
  },

  getResult: async (id: number) => {
    const result = await request<RenderResult>(`/api/results/${id}`);
    return normalizeRenderResult(result);
  },

  exportExcel: (resultId: number) => {
    const token = getToken();
    return fetch(apiUrl(`/api/results/${resultId}/export/excel`), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  listWorks: async () => {
    const works = await request<Work[]>("/api/community/works");
    return works.map(normalizeWork);
  },
  publishWork: async (body: { result_id: number; title: string; description?: string }) =>
    normalizeWork(await request<Work>("/api/community/works", { method: "POST", body: JSON.stringify(body) })),
  getWork: async (workId: number) => normalizeWork(await request<Work>(`/api/community/works/${workId}`)),
  listWorkComments: (workId: number) => request<WorkComment[]>(`/api/community/works/${workId}/comments`),
  addWorkComment: (workId: number, content: string) =>
    request<WorkComment>(`/api/community/works/${workId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  likeWork: (workId: number) => request<{ ok: boolean; liked: boolean; like_count: number }>(`/api/community/works/${workId}/like`, { method: "POST" }),
  unlikeWork: (workId: number) => request<{ ok: boolean; liked: boolean; like_count: number }>(`/api/community/works/${workId}/like`, { method: "DELETE" }),
  getLikeLeaderboard: () => request<LeaderboardItem[]>("/api/community/leaderboard/likes"),
  listNotices: () => request<Notice[]>("/api/community/notifications"),
  readAllNotices: () => request<{ ok: boolean; count: number }>("/api/community/notifications/read-all", { method: "POST" }),
  listAnnouncements: () => request<Announcement[]>("/api/community/announcements"),
  createAnnouncement: (title: string, content: string) =>
    request<Announcement>("/api/community/admin/announcements", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),
  createAdminInviteCode: () => request<{ code: string; created_by: number }>("/api/community/admin/invite-codes", { method: "POST" }),
  removeWork: (workId: number, reason: string) =>
    request<{ ok: boolean }>(`/api/community/admin/works/${workId}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  removeComment: (commentId: number, reason: string) =>
    request<{ ok: boolean }>(`/api/community/admin/comments/${commentId}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  listModerationLogs: () => request<ModerationLogItem[]>("/api/community/admin/moderation-logs"),
};
