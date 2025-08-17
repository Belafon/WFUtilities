import path from 'path';
import { config } from '../WFServerConfig';
import { charactersDir, chaptersDir, passageFilePostfixScreen, locationsDir, sideCharacterDir, locationFilePostfix } from '../Paths';
import { ICharacterParams, IChapterParams, IChapterPassagesParams, IScreenPassageParams, ILocationParams, ISideCharacterParams } from './TempalteGenerator';

export interface ISaveResult {
    success: boolean;
    filePath: string;
    error?: string;
}

export class TemplateFileSaver {

    /**
     * Saves a character file to the characters directory
     * Path: /src/data/characters/{characterId}.ts
     */
    public async saveCharacter(params: ICharacterParams, content: string): Promise<ISaveResult> {
        try {
            const fileName = `${params.characterId}.ts`;
            const filePath = path.join(charactersDir(), fileName);

            this.ensureDirectoryExists(charactersDir());

            config.fileSystem.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                filePath
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Saves an chapter file to the chapters directory
     * Path: /src/data/chapters/{chapterId}/{chapterId}.chapter.ts
     */
    public async saveChapter(params: IChapterParams, content: string): Promise<ISaveResult> {
        try {
            const filePath = this.getChapterFilePath(params.chapterId);
            const chapterDir = path.dirname(filePath);

            this.ensureDirectoryExists(chapterDir);

            config.fileSystem.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                filePath
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Saves a screen passage file to the chapters directory
     * Path: /src/data/chapters/{chapterId}/{characterId}.passages/{passageId}.screen.ts
     */
    public async saveScreenPassage(params: IScreenPassageParams, content: string): Promise<ISaveResult> {
        try {
            const passagesDir = path.join(chaptersDir(), params.chapterId, `${params.characterId}.passages`);
            const fileName = `${params.passageId}${passageFilePostfixScreen}`;
            const filePath = path.join(passagesDir, fileName);

            this.ensureDirectoryExists(passagesDir);

            config.fileSystem.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                filePath
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Saves an chapter passages file to the chapters directory
     * Path: /src/data/chapters/{chapterId}/{chapterId}.passages.ts
     */
    public async saveChapterPassages(params: IChapterPassagesParams, content: string): Promise<ISaveResult> {
        try {
            const filePath = this.getChapterPassagesFilePath(params.chapterId);
            const chapterDir = path.dirname(filePath);

            this.ensureDirectoryExists(chapterDir);

            config.fileSystem.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                filePath
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Saves a location file to the locations directory
     * Path: /src/data/locations/{locationId}.location.ts
     */
    public async saveLocation(params: ILocationParams, content: string): Promise<ISaveResult> {
        try {
            const fileName = `${params.locationId}${locationFilePostfix}`;
            const filePath = path.join(locationsDir(), fileName);

            this.ensureDirectoryExists(locationsDir());

            config.fileSystem.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                filePath
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Saves a side character file to the side characters directory
     * Path: /src/data/sideCharacters/{sideCharacterId}.ts
     */
    public async saveSideCharacter(params: ISideCharacterParams, content: string): Promise<ISaveResult> {
        try {
            const fileName = `${params.sideCharacterId}.ts`;
            const filePath = path.join(sideCharacterDir(), fileName);

            this.ensureDirectoryExists(sideCharacterDir());

            config.fileSystem.writeFileSync(filePath, content, 'utf8');

            return {
                success: true,
                filePath
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Ensures a directory exists, creating it recursively if necessary
     */
    private ensureDirectoryExists(dirPath: string): void {
        if (!config.fileSystem.existsSync(dirPath)) {
            config.fileSystem.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Gets the file path that would be used for a character (without saving)
     */
    public getCharacterFilePath(characterId: string): string {
        return path.join(charactersDir(), `${characterId}.ts`);
    }

    /**
     * Gets the file path that would be used for an chapter (without saving)
     */
    public getChapterFilePath(chapterId: string): string {
        return path.join(chaptersDir(), chapterId, `${chapterId}.chapter.ts`);
    }

    /**
     * Gets the file path that would be used for an chapter passages file (without saving)
     */
    public getChapterPassagesFilePath(chapterId: string): string {
        return path.join(chaptersDir(), chapterId, `${chapterId}.passages.ts`);
    }

    /**
     * Gets the file path that would be used for a screen passage (without saving)
     */
    public getScreenPassageFilePath(chapterId: string, characterId: string, passageId: string): string {
        const passagesDir = path.join(chaptersDir(), chapterId, `${characterId}.passages`);
        return path.join(passagesDir, `${passageId}${passageFilePostfixScreen}`);
    }

    /**
     * Gets the file path that would be used for a location (without saving)
     */
    public getLocationFilePath(locationId: string): string {
        return path.join(locationsDir(), `${locationId}${locationFilePostfix}`);
    }

    /**
     * Gets the file path that would be used for a side character (without saving)
     */
    public getSideCharacterFilePath(sideCharacterId: string): string {
        return path.join(sideCharacterDir(), `${sideCharacterId}.ts`);
    }

    /**
     * Checks if a file already exists at the target location
     */
    public fileExists(filePath: string): boolean {
        return config.fileSystem.existsSync(filePath);
    }

    /**
     * Validates that all necessary directories are accessible
     */
    public validateDirectories(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        try {
            // Check if characters directory is accessible
            if (!config.fileSystem.existsSync(charactersDir())) {
                this.ensureDirectoryExists(charactersDir());
            }
        } catch (error) {
            errors.push(`Characters directory: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
            // Check if chapters directory is accessible
            if (!config.fileSystem.existsSync(chaptersDir())) {
                this.ensureDirectoryExists(chaptersDir());
            }
        } catch (error) {
            errors.push(`Chapters directory: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
            // Check if locations directory is accessible
            if (!config.fileSystem.existsSync(locationsDir())) {
                this.ensureDirectoryExists(locationsDir());
            }
        } catch (error) {
            errors.push(`Locations directory: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
            // Check if side characters directory is accessible
            if (!config.fileSystem.existsSync(sideCharacterDir())) {
                this.ensureDirectoryExists(sideCharacterDir());
            }
        } catch (error) {
            errors.push(`Side characters directory: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}