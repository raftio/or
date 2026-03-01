export interface CodeFileDto {
  path: string;
  content: string;
  sha: string;
  size: number;
  language: string | null;
}

export interface RepoTreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface ListFilesOptions {
  ref?: string;
  pathPrefix?: string;
  extensions?: string[];
  maxFileSize?: number;
}
