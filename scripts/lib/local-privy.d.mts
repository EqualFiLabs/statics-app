export interface PublicPrivyConfig {
  appId: string;
  clientId?: string;
}

export function readPublicPrivyConfig(contents: string): PublicPrivyConfig;

export function mergePublicPrivyConfig(contents: string, config: PublicPrivyConfig): string;

export function importPublicPrivyConfig(options: { sourcePath: string; targetPath: string }): {
  importedNames: string[];
};
