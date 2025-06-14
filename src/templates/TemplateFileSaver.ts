import path from 'path';
import { config } from '../WFServerConfig';
import { charactersDir, eventsDir, passageFilePostfixScreen, locationsDir, sideCharacterDir, locationFilePostfix } from '../Paths';
import { ICharacterParams, IEventParams, IEventPassagesParams, IScreenPassageParams, ILocationParams, ISideCharacterParams } from './TempalteGenerator';

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
     * Saves an event file to the events directory
     * Path: /src/data/events/{eventId}/{eventId}.event.ts
     */
    public async saveEvent(params: IEventParams, content: string): Promise<ISaveResult> {
        try {
            const filePath = this.getEventFilePath(params.eventId);
            const eventDir = path.dirname(filePath);

            this.ensureDirectoryExists(eventDir);

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
     * Saves a screen passage file to the events directory
     * Path: /src/data/events/{eventId}/{characterId}.passages/{passageId}.screen.ts
     */
    public async saveScreenPassage(params: IScreenPassageParams, content: string): Promise<ISaveResult> {
        try {
            const passagesDir = path.join(eventsDir(), params.eventId, `${params.characterId}.passages`);
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
     * Saves an event passages file to the events directory
     * Path: /src/data/events/{eventId}/{eventId}.passages.ts
     */
    public async saveEventPassages(params: IEventPassagesParams, content: string): Promise<ISaveResult> {
        try {
            const filePath = this.getEventPassagesFilePath(params.eventId);
            const eventDir = path.dirname(filePath);

            this.ensureDirectoryExists(eventDir);

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
     * Gets the file path that would be used for an event (without saving)
     */
    public getEventFilePath(eventId: string): string {
        return path.join(eventsDir(), eventId, `${eventId}.event.ts`);
    }

    /**
     * Gets the file path that would be used for an event passages file (without saving)
     */
    public getEventPassagesFilePath(eventId: string): string {
        return path.join(eventsDir(), eventId, `${eventId}.passages.ts`);
    }

    /**
     * Gets the file path that would be used for a screen passage (without saving)
     */
    public getScreenPassageFilePath(eventId: string, characterId: string, passageId: string): string {
        const passagesDir = path.join(eventsDir(), eventId, `${characterId}.passages`);
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
            // Check if events directory is accessible
            if (!config.fileSystem.existsSync(eventsDir())) {
                this.ensureDirectoryExists(eventsDir());
            }
        } catch (error) {
            errors.push(`Events directory: ${error instanceof Error ? error.message : String(error)}`);
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