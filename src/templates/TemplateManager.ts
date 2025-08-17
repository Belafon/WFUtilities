import { ICharacterParams, IChapterParams, IScreenPassageParams, IChapterPassagesParams, ILocationParams, ISideCharacterParams, TemplateGenerator } from './TempalteGenerator';
import { TemplateFileSaver, ISaveResult } from './TemplateFileSaver';

export interface IGenerateAndSaveResult extends ISaveResult {
    content: string;
}

class TemplateManager {
    private generator: TemplateGenerator;
    private fileSaver: TemplateFileSaver;

    constructor() {
        this.generator = new TemplateGenerator();
        this.fileSaver = new TemplateFileSaver();
    }

    /**
     * Generates and saves a character file in one operation
     */
    public async generateAndSaveCharacter(params: ICharacterParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createCharacter(params);
            const saveResult = await this.fileSaver.saveCharacter(params, content);
            
            return {
                ...saveResult,
                content
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generates and saves an chapter file in one operation
     */
    public async generateAndSaveChapter(params: IChapterParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createChapter(params);
            const saveResult = await this.fileSaver.saveChapter(params, content);
            
            return {
                ...saveResult,
                content
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generates and saves a screen passage file in one operation
     */
    public async generateAndSaveScreenPassage(params: IScreenPassageParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createScreenPassage(params);
            const saveResult = await this.fileSaver.saveScreenPassage(params, content);
            
            return {
                ...saveResult,
                content
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generates and saves an chapter passages file in one operation
     */
    public async generateAndSaveChapterPassages(params: IChapterPassagesParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createChapterPassages(params);
            const saveResult = await this.fileSaver.saveChapterPassages(params, content);
            
            return {
                ...saveResult,
                content
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generates and saves a location file in one operation
     */
    public async generateAndSaveLocation(params: ILocationParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createLocation(params);
            const saveResult = await this.fileSaver.saveLocation(params, content);
            
            return {
                ...saveResult,
                content
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generates and saves a side character file in one operation
     */
    public async generateAndSaveSideCharacter(params: ISideCharacterParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createSideCharacter(params);
            const saveResult = await this.fileSaver.saveSideCharacter(params, content);
            
            return {
                ...saveResult,
                content
            };
        } catch (error) {
            return {
                success: false,
                filePath: '',
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Preview file paths without generating or saving
     */
    public previewFilePaths(params: ICharacterParams | IChapterParams | IScreenPassageParams | IChapterPassagesParams | ILocationParams | ISideCharacterParams): string {
        if ('characterId' in params && !('chapterId' in params)) {
            // Character params
            return this.fileSaver.getCharacterFilePath(params.characterId);
        } else if ('locationId' in params) {
            // Location params
            return this.fileSaver.getLocationFilePath((params as ILocationParams).locationId);
        } else if ('sideCharacterId' in params) {
            // Side character params
            return this.fileSaver.getSideCharacterFilePath((params as ISideCharacterParams).sideCharacterId);
        } else if ('chapterId' in params && !('characterId' in params) && !('passageId' in params)) {
            // Could be Chapter params or ChapterPassages params
            if ('title' in params || 'description' in params) {
                // Chapter params (has properties specific to chapters)
                return this.fileSaver.getChapterFilePath((params as IChapterParams).chapterId);
            } else {
                // ChapterPassages params
                return this.fileSaver.getChapterPassagesFilePath((params as IChapterPassagesParams).chapterId);
            }
        } else if ('chapterId' in params && 'characterId' in params && 'passageId' in params) {
            // Screen passage params
            const p = params as IScreenPassageParams;
            return this.fileSaver.getScreenPassageFilePath(p.chapterId, p.characterId, p.passageId);
        }
        
        throw new Error('Invalid parameters provided');
    }

    /**
     * Check if files would overwrite existing files
     */
    public async checkForConflicts(params: ICharacterParams | IChapterParams | IScreenPassageParams | IChapterPassagesParams | ILocationParams | ISideCharacterParams): Promise<{
        hasConflict: boolean;
        existingFilePath?: string;
    }> {
        const filePath = this.previewFilePaths(params);
        const exists = this.fileSaver.fileExists(filePath);
        
        return {
            hasConflict: exists,
            existingFilePath: exists ? filePath : undefined
        };
    }

    /**
     * Validates the workspace and directories before operations
     */
    public validateSetup(): { valid: boolean; errors: string[] } {
        return this.fileSaver.validateDirectories();
    }

    /**
     * Gets the generator instance for advanced operations
     */
    public getGenerator(): TemplateGenerator {
        return this.generator;
    }

    /**
     * Gets the file saver instance for advanced operations
     */
    public getFileSaver(): TemplateFileSaver {
        return this.fileSaver;
    }
}

export const templateManager = new TemplateManager();