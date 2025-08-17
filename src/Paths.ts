import path from 'path';
import { config } from './WFServerConfig';

export const workspaceFolders = () => config.workspaceAdapter.getWorkspaceFolderPath();

export const locationsDir = () => path.join(workspaceFolders(), 'src', 'data', 'locations');

export const charactersDir = () => path.join(workspaceFolders(), 'src', 'data', 'characters');

export const registerFilePath = () => path.join(workspaceFolders(), 'src', 'data', 'register.ts');

export const worldStateFilePath = () => path.join(workspaceFolders(), 'src', 'data', 'TWorldState.ts');

export const sideCharacterDir = () => path.join(workspaceFolders(), 'src', 'data', 'sideCharacters');

export const locationFilePostfix = '.location.ts';
export const locationFilePostfixWithoutFileType = '.location';

export const chapterFilePostfix = '.chapter.ts';
export const chapterPassagesFilePostfix = '.passages.ts';
export const chapterPassagesFilePostfixWithoutFileType = '.passages';
export const chapterFilePostfixWithoutFileType = '.chapter';

export const chaptersDir = () => path.join(workspaceFolders(), 'src', 'data', 'chapters');

/**
 * Gets the full path to an chapter file based on the chapter ID.
 * Creates a path structure like: /src/data/chapters/{chapterId}/{chapterId}.chapter.ts
 * @param chapterId The ID of the chapter
 * @returns The full path to the chapter file
 */
export const getChapterFilePath = (chapterId: string): string => {
  return path.join(chaptersDir(), chapterId, `${chapterId}${chapterFilePostfix}`);
};

export const passageFilePostfix = '.ts';
export const passageFilePostfixScreen = '.screen.ts';
export const passageFilePostfixTransition = '.transition.ts';
export const passageFilePostfixLinear = '.linear.ts';

export const racesFilePath = () => path.join(workspaceFolders(), 'src', 'data', 'races', 'races.ts');
export const racesDir = () => path.join(workspaceFolders(), 'src', 'data', 'races');

// New paths for maps functionality
export const mapsDir = () => path.join(workspaceFolders(), 'src', 'data', 'maps');
export const mapFileExtension = '.json';

// Templates functionality
export const templatesDir = () => path.join(workspaceFolders(), 'src', 'templates');
export const getImportToChapterPassagesFile = (chapterId: string): string => {
  return 'import(\'./chapters/' + chapterId + '/' + chapterId + chapterPassagesFilePostfixWithoutFileType + '\')';
}
/**
 * Gets the full path to a template file
 * @param templateFileName The name of the template file (e.g., 'character.template')
 * @returns The full path to the template file
 */
export const getTemplateFilePath = (templateFileName: string): string => {
  return path.join(templatesDir(), templateFileName);
};

/**
 * Validates that the workspace is properly configured and accessible
 * @returns true if workspace is valid, false otherwise
 */
export const validateWorkspace = (): boolean => {
  return config.workspaceAdapter.isWorkspaceValid();
};

/**
 * Gets workspace information for debugging/logging purposes
 * @returns object containing workspace path and validity, or error information
 */
export const getWorkspaceInfo = () => {
  try {
    const workspacePath = workspaceFolders();
    const isValid = validateWorkspace();
    
    return {
      path: workspacePath,
      isValid,
      exists: config.fileSystem.existsSync(workspacePath),
      configured: true
    };
  } catch (error) {
    return {
      path: null,
      isValid: false,
      exists: false,
      configured: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};