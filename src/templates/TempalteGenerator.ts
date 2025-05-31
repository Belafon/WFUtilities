import { config } from '../WFServerConfig';
import { CharacterTemplateVariables } from './character.template';
import { EventTemplateVariables } from './event.template';
import { PassageScreenTemplateVariables } from './passage.screen.template';

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
    childEventName?: string;
    childEventImportPath?: string;
    childCondition?: string;
    initObjectContent?: string;
    eventDataTypeContent?: string;
}

export interface IScreenPassageParams {
    eventId: string;
    characterId: string;
    passageId: string;
}

export class TemplateGenerator {

    /**
     * Creates a character file using the character template
     */
    public async createCharacter(params: ICharacterParams): Promise<string> {
        const template = this.loadTemplate('character.template');

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
        const template = this.loadTemplate('event.template');

        const variables = new EventTemplateVariables(
            params.eventId,
            params.title,
            params.description,
            params.location,
            params.timeStart,
            params.timeEnd,
            params.childEventName,
            params.childEventImportPath,
            params.childCondition
        );

        return variables.generateEventCode(template, params.initObjectContent, params.eventDataTypeContent);
    }

    /**
     * Creates a screen passage file using the passage screen template
     */
    public async createScreenPassage(params: IScreenPassageParams): Promise<string> {
        const template = this.loadTemplate('passage.screen.template');

        const variables = new PassageScreenTemplateVariables(
            params.eventId,
            params.characterId,
            params.passageId
        );

        return variables.generatePassageCode(template);
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
     * Loads a template file and returns its content
     */
    private loadTemplate(templateFileName: string): string {
        try {
            const templateContent = config.fileSystem.readFileSync(templateFileName, 'utf8');
            return templateContent;
        } catch (error) {
            throw new Error(`Failed to load template file: ${templateFileName}. Error: ${error}`);
        }
    }
}