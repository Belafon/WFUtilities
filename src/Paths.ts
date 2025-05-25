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

export const eventFilePostfix = '.event.ts';
export const eventPassagesFilePostfix = '.passages.ts';
export const evnetPassagesFilePostfixWithoutFileType = '.passages';
export const eventFilePostfixWithoutFileType = '.event';

export const eventsDir = () => path.join(workspaceFolders(), 'src', 'data', 'events');

/**
 * Gets the full path to an event file based on the event ID.
 * Creates a path structure like: /src/data/events/{eventId}/{eventId}.event.ts
 * @param eventId The ID of the event
 * @returns The full path to the event file
 */
export const getEventFilePath = (eventId: string): string => {
  return path.join(eventsDir(), eventId, `${eventId}${eventFilePostfix}`);
};

export const passageFilePostfix = '.ts';

export const racesFilePath = () => path.join(workspaceFolders(), 'src', 'data', 'races', 'races.ts');
export const racesDir = () => path.join(workspaceFolders(), 'src', 'data', 'races');

// New paths for maps functionality
export const mapsDir = () => path.join(workspaceFolders(), 'src', 'data', 'maps');
export const mapFileExtension = '.json';

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