// Projects API: list, create, read, update, delete and duplicate. All calls need a signed-in user.
import { http } from "./http";
import type { CreateProjectInput, ListProjectsParams, ProjectDetail, ProjectList, UpdateProjectInput } from "./types";

export async function listProjects(params: ListProjectsParams = {}): Promise<ProjectList> {
  const { data } = await http.get<ProjectList>("/api/projects", { params });
  return data;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  const { data } = await http.post<ProjectDetail>("/api/projects", input);
  return data;
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  const { data } = await http.get<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`);
  return data;
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<ProjectDetail> {
  const { data } = await http.patch<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`, input);
  return data;
}

// Deletes the project with all its folders, icons and versions.
export async function deleteProject(projectId: string): Promise<{ deletedIcons: number; deletedFolders: number }> {
  const { data } = await http.delete<{ deletedIcons: number; deletedFolders: number }>(`/api/projects/${encodeURIComponent(projectId)}`);
  return data;
}

// Copies a project you can see into a new private project you own.
export async function duplicateProject(projectId: string): Promise<ProjectDetail> {
  const { data } = await http.post<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}/duplicate`);
  return data;
}
