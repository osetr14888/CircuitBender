import { supabase } from './supabase';
import type { SchematicProject } from '../types/schematic';

export interface CloudProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface CloudProject {
  id: string;
  name: string;
  data: SchematicProject;
  updatedAt: string;
}

const PROJECT_COLUMNS = 'id, name, data, updated_at';

function requireClient(): NonNullable<typeof supabase> {
  if (supabase === null) {
    throw new Error(
      'Cloud sync is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.',
    );
  }
  return supabase;
}

function toProject(value: unknown): SchematicProject {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Saved project data is corrupted.');
  }
  const candidate = value as Partial<SchematicProject>;
  if (
    candidate.version !== 1 ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.components) ||
    !Array.isArray(candidate.nets)
  ) {
    throw new Error('Saved project uses an unsupported format.');
  }
  return {
    version: 1,
    name: candidate.name,
    components: candidate.components,
    nets: candidate.nets,
  };
}

export async function saveProjectToCloud(
  project: SchematicProject,
  userId: string,
  projectId: string | null,
): Promise<CloudProject> {
  const client = requireClient();
  const row = {
    ...(projectId === null ? {} : { id: projectId }),
    user_id: userId,
    name: project.name.trim() === '' ? 'Untitled' : project.name,
    data: project,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('projects')
    .upsert(row)
    .select(PROJECT_COLUMNS)
    .single();

  if (error !== null) {
    throw new Error(error.message);
  }
  return {
    id: data.id,
    name: data.name,
    data: toProject(data.data),
    updatedAt: data.updated_at,
  };
}

export async function listCloudProjects(userId: string): Promise<CloudProjectSummary[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select('id, name, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error !== null) {
    throw new Error(error.message);
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  }));
}

export async function loadCloudProject(projectId: string): Promise<CloudProject> {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .single();

  if (error !== null) {
    throw new Error(error.message);
  }
  return {
    id: data.id,
    name: data.name,
    data: toProject(data.data),
    updatedAt: data.updated_at,
  };
}
