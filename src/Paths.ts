import path from 'path';

export const workspaceFolders = () => '/home/belafon/Documents/projects/WFUtilities/workspace';
export const locationsDir = () => path.join(workspaceFolders()!, 'src', 'data', 'locations');

export const charactersDir = () => path.join(workspaceFolders()!, 'src', 'data', 'characters');

export const registerFilePath = () => path.join(workspaceFolders()!, 'src', 'data', 'register.ts');

export const worldStateFilePath = () => path.join(workspaceFolders()!, 'src', 'data', 'TWorldState.ts');

export const sideCharacterDir = () => path.join(workspaceFolders()!, 'src', 'data', 'sideCharacters');

export const locationFilePostfix = '.location.ts';
export const locationFilePostfixWithoutFileType = '.location';

export const eventFilePostfix = '.event.ts';
export const eventPassagesFilePostfix = '.passages.ts';
export const evnetPassagesFilePostfixWithoutFileType = '.passages';
export const eventFilePostfixWithoutFileType = '.event';

export const eventsDir = () => path.join(workspaceFolders()!, 'src', 'data', 'events');


export const passageFilePostfix = '.ts';


export const racesFilePath = () => path.join(workspaceFolders()!, 'src', 'data', 'races', 'races.ts');
export const racesDir = () => path.join(workspaceFolders()!, 'src', 'data', 'races');