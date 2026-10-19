// Shapes returned by the server for projects, folders and icons. Dates arrive as ISO strings.

export type ProjectPurpose = "sprite" | "font";
export type ProjectVisibility = "public" | "private";
export type DuplicateStrategy = "rename" | "replace" | "skip";

// What the signed-in user may do with a project. Use these to decide which controls to show.
export type ProjectAccess = {
  canView: boolean;
  canCopyFrom: boolean;
  canEdit: boolean;
  canAddIcons: boolean;
  canManage: boolean;
};

export type SampleIcon = { id: string; name: string; svg: string };

export type ProjectOwner = { id: string; displayName: string; email?: string };

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  prefix: string;
  color: string;
  purpose: ProjectPurpose;
  visibility: ProjectVisibility;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  owner: ProjectOwner;
  iconCount: number;
  sampleIcons: SampleIcon[];
  access: ProjectAccess;
};

export type ProjectDetail = ProjectSummary & { folderCount: number; trashCount: number };

export type ProjectList = { projects: ProjectSummary[]; total: number; page: number; limit: number };

export type ListProjectsParams = {
  scope?: "all" | "mine" | "public";
  status?: "active" | "archived" | "all";
  purpose?: "all" | ProjectPurpose;
  search?: string;
  sort?: "updated" | "created" | "name" | "icons";
  page?: number;
  limit?: number;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  prefix?: string;
  color?: string;
  purpose?: ProjectPurpose;
  visibility?: ProjectVisibility;
};

// Purpose cannot change after creation.
export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "purpose">> & { isArchived?: boolean };

export type FolderItem = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  orderIndex: number;
};

export type FolderWithCount = FolderItem & { iconCount: number };
export type FolderList = { folders: FolderWithCount[]; uncategorizedCount: number };

export type IconItem = {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  slug: string;
  tags: string[];
  byteSize: number;
  originalByteSize: number;
  codepoint: string | null;
  width: number;
  height: number;
  viewBox: string;
  hasStroke: boolean;
  hasGradient: boolean;
  hasText: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Present unless the list was requested with svg=false, and never in upload summaries.
  svg?: string;
};

export type IconVersion = { id: string; byteSize: number; createdAt: string };
export type IconDetail = IconItem & { svg: string; versions: IconVersion[] };
export type IconList = { icons: IconItem[]; total: number; page: number; limit: number };

export type IconSearchResult = IconItem & {
  project: { id: string; name: string; prefix: string; color: string; visibility: ProjectVisibility; purpose: ProjectPurpose } | null;
};
export type IconSearchList = { icons: IconSearchResult[]; total: number; page: number; limit: number };

export type ListIconsParams = {
  // A folder id, "root" for uncategorized icons, or leave out for the whole project.
  folderId?: string;
  includeSubfolders?: boolean;
  search?: string;
  tag?: string;
  trash?: boolean;
  sort?: "newest" | "oldest" | "name" | "name-desc" | "largest" | "deleted";
  page?: number;
  limit?: number;
  svg?: boolean;
};

export type UploadOptions = {
  folderId?: string | null;
  strategy?: DuplicateStrategy;
  optimize?: boolean;
  tags?: string[];
};

export type UploadSummary = {
  created: IconItem[];
  replaced: IconItem[];
  skipped: { name: string; reason: string }[];
  errors: { file: string; message: string }[];
  foldersCreated: number;
  limitPerUpload?: number;
};

export type PasteIconInput = {
  rawSvg: string;
  name?: string;
  folderId?: string | null;
  optimize?: boolean;
  tags?: string[];
  strategy?: DuplicateStrategy;
};

export type PasteResult =
  | { outcome: "created" | "replaced"; icon: IconItem & { svg: string } }
  | { outcome: "skipped"; reason: string };

export type UpdateIconInput = {
  name?: string;
  folderId?: string | null;
  tags?: string[];
  codepoint?: string | null;
  rawSvg?: string;
};

export type OptimizeResult = { icon: IconItem; changed: boolean; before: number; after: number; savingsPercent: number };
export type RestoreResult = { icon: IconItem; adjusted: string[] };

export type BatchResult = { requested: number; matched: number };
export type BatchRestoreResult = BatchResult & { adjusted: { id: string; changes: string[] }[] };
export type BatchOptimizeResult = BatchResult & {
  optimized: number;
  bytesBefore: number;
  bytesAfter: number;
  failed: { id: string; message: string }[];
};

export type DownloadedFile = { blob: Blob; filename: string };
