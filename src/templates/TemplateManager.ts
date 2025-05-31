import { ICharacterParams, IEventParams, IScreenPassageParams, TemplateGenerator } from './TempalteGenerator';
import { TemplateFileSaver, ISaveResult } from './TemplateFileSaver';

export interface IGenerateAndSaveResult extends ISaveResult {
    content: string;
}

export class TemplateManager {
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
     * Generates and saves an event file in one operation
     */
    public async generateAndSaveEvent(params: IEventParams): Promise<IGenerateAndSaveResult> {
        try {
            const content = await this.generator.createEvent(params);
            const saveResult = await this.fileSaver.saveEvent(params, content);
            
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
     * Preview file paths without generating or saving
     */
    public previewFilePaths(params: ICharacterParams | IEventParams | IScreenPassageParams): string {
        if ('characterId' in params && !('eventId' in params)) {
            // Character params
            return this.fileSaver.getCharacterFilePath(params.characterId);
        } else if ('eventId' in params && !('characterId' in params)) {
            // Event params
            return this.fileSaver.getEventFilePath((params as IEventParams).eventId);
        } else if ('eventId' in params && 'characterId' in params && 'passageId' in params) {
            // Screen passage params
            const p = params as IScreenPassageParams;
            return this.fileSaver.getScreenPassageFilePath(p.eventId, p.characterId, p.passageId);
        }
        
        throw new Error('Invalid parameters provided');
    }

    /**
     * Check if files would overwrite existing files
     */
    public async checkForConflicts(params: ICharacterParams | IEventParams | IScreenPassageParams): Promise<{
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