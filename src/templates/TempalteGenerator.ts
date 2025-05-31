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
     * Creates an event passages file using the event passages template
     */
    public async createEventPassages(params: IEventPassagesParams): Promise<string> {
        const template = this.loadTemplate('event.passages.template');

        const variables = new EventPassagesTemplateVariables(
            params.eventId
        );

        return variables.generateEventPassagesCode(template);
    }

    /**
     * Creates a location file using the location template
     */
    public async createLocation(params: ILocationParams): Promise<string> {
        const template = this.loadTemplate('location.template');

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
        const template = this.loadTemplate('sideCharacter.template');

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
            const templateContent = config.fileSystem.readFileSync(templateFileName, 'utf8');
            return templateContent;
        } catch (error) {
            throw new Error(`Failed to load template file: ${templateFileName}. Error: ${error}`);
        }
    }
}