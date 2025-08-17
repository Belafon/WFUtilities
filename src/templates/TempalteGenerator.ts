import path from 'path';
import { config } from '../WFServerConfig';
import { CharacterTemplateVariables } from './character.template';
import { EventTemplateVariables } from './event.template';
import { EventPassagesTemplateVariables } from './eventPassages.template';
import { PassageScreenTemplateVariables } from './passage.screen.template';
import { LocationTemplateVariables } from './location.template';
import { SideCharacterTemplateVariables } from './sideCharacter.template';

export interface ICharacterParams {
    characterId: string;
    characterName?: string;
    startEventId?: string;
    startPassageId?: string;
    startLocation?: string;
    health?: number;
    hunger?: number;
    stamina?: number;
    inventoryItems?: string;
    initObjectContent?: string;
    characterDataTypeContent?: string;
}

export interface IEventParams {
    eventId: string;
    title?: string;
    description?: string;
    location?: string;
    timeStart?: string;
    timeEnd?: string;
    initObjectContent?: string;
    eventDataTypeContent?: string;
}

export interface IScreenPassageParams {
    eventId: string;
    characterId: string;
    passageId: string;
}

export interface IEventPassagesParams {
    eventId: string;
}

export interface ILocationParams {
    locationId: string;
    locationName?: string;
    description?: string;
    localCharacters?: string;
    initObjectContent?: string;
    locationDataTypeContent?: string;
}

export interface ISideCharacterParams {
    sideCharacterId: string;
    sideCharacterName?: string;
    description?: string;
    inventory?: string;
    location?: string;
    isDead?: boolean;
    initObjectContent?: string;
    sideCharacterDataTypeContent?: string;
}

export class TemplateGenerator {
    
    /**
     * Gets the path to the templates directory
     */
    private getTemplatesDir(): string {
        try {
            // First try to get from workspace (for development in consuming projects)
            const workspaceFolder = config.workspaceAdapter.getWorkspaceFolderPath();
            if (workspaceFolder) {
                const workspaceTemplatesDir = path.join(workspaceFolder, 'src', 'templates');
                if (config.fileSystem.existsSync(workspaceTemplatesDir)) {
                    return workspaceTemplatesDir;
                }
            }
        } catch (error) {
            // Workspace adapter failed, continue to other methods
        }
        
        // For library usage: find templates relative to this module
        const currentDir = __dirname;
        
        // Check if we're in the library's compiled dist directory
        if (currentDir.includes('dist')) {
            // When used as a library: dist/templates should exist
            const libTemplatesDir = path.join(currentDir, '..', 'templates');
            if (config.fileSystem.existsSync(libTemplatesDir)) {
                return libTemplatesDir;
            }
            
            // Fallback for source directory access
            return path.join(currentDir, '..', '..', 'src', 'templates');
        } else {
            // Development mode: we're in src/templates
            return currentDir;
        }
    }

    /**
     * Creates a character file using the character template
     */
    public async createCharacter(params: ICharacterParams): Promise<string> {
        const template = this.loadTemplate('character.hbs');

        const variables = new CharacterTemplateVariables(
            params.characterId,
            params.characterName,
            params.startEventId,
            params.startPassageId,
            params.startLocation,
            params.health,
            params.hunger,
            params.stamina,
            params.inventoryItems
        );

        return variables.generateCharacterCode(template, params.initObjectContent, params.characterDataTypeContent);
    }

    /**
     * Creates an event file using the event template
     */
    public async createEvent(params: IEventParams): Promise<string> {
        const template = this.loadTemplate('event.hbs');

        const variables = new EventTemplateVariables(
            params.eventId,
            params.title,
            params.description,
            params.location,
            params.timeStart,
            params.timeEnd,
        );

        return variables.generateEventCode(template, params.initObjectContent, params.eventDataTypeContent);
    }

    /**
     * Creates a screen passage file using the passage screen template
     */
    public async createScreenPassage(params: IScreenPassageParams): Promise<string> {
        const template = this.loadTemplate('passage.screen.hbs');

        const variables = new PassageScreenTemplateVariables(
            params.eventId,
            params.characterId,
            params.passageId
        );

        return variables.generatePassageCode(template);
    }

    /**
     * Creates an event passages file using the event passages template
     */
    public async createEventPassages(params: IEventPassagesParams): Promise<string> {
        const template = this.loadTemplate('eventPassages.hbs');

        const variables = new EventPassagesTemplateVariables(
            params.eventId
        );

        return variables.generateEventPassagesCode(template);
    }

    /**
     * Creates a location file using the location template
     */
    public async createLocation(params: ILocationParams): Promise<string> {
        const template = this.loadTemplate('location.hbs');

        const variables = new LocationTemplateVariables(
            params.locationId,
            params.locationName,
            params.description,
            params.localCharacters
        );

        return variables.generateLocationCode(template, params.initObjectContent, params.locationDataTypeContent);
    }

    /**
     * Creates a side character file using the side character template
     */
    public async createSideCharacter(params: ISideCharacterParams): Promise<string> {
        const template = this.loadTemplate('sideCharacter.hbs');

        const variables = new SideCharacterTemplateVariables(
            params.sideCharacterId,
            params.sideCharacterName,
            params.description,
            params.inventory,
            params.location,
            params.isDead
        );

        return variables.generateSideCharacterCode(template, params.initObjectContent, params.sideCharacterDataTypeContent);
    }

    /**
     * Creates a character with minimal required parameters
     */
    public async createSimpleCharacter(characterId: string, characterName?: string): Promise<string> {
        return this.createCharacter({ characterId, characterName });
    }

    /**
     * Creates an event with minimal required parameters
     */
    public async createSimpleEvent(eventId: string, title?: string): Promise<string> {
        return this.createEvent({ eventId, title });
    }

    /**
     * Creates an empty event passages file with minimal required parameters
     */
    public async createSimpleEventPassages(eventId: string): Promise<string> {
        return this.createEventPassages({ eventId });
    }

    /**
     * Creates a location with minimal required parameters
     */
    public async createSimpleLocation(locationId: string, locationName?: string): Promise<string> {
        return this.createLocation({ locationId, locationName });
    }

    /**
     * Creates a side character with minimal required parameters
     */
    public async createSimpleSideCharacter(sideCharacterId: string, sideCharacterName?: string): Promise<string> {
        return this.createSideCharacter({ sideCharacterId, sideCharacterName });
    }

    /**
     * Loads a template file and returns its content
     */
    private loadTemplate(templateFileName: string): string {
        try {
            const templatesDir = this.getTemplatesDir();
            const templatePath = path.join(templatesDir, templateFileName);
            const templateContent = config.fileSystem.readFileSync(templatePath, 'utf8');
            return templateContent;
        } catch (error) {
            const templatesDir = this.getTemplatesDir();
            const templatePath = path.join(templatesDir, templateFileName);
            throw new Error(`Failed to load template file: ${templatePath}. Error: ${error}`);
        }
    }
}