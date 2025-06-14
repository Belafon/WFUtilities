import path from 'path';
import { registerFilePath } from '../Paths';
import { config } from '../WFServerConfig';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';
import { EventTemplateVariables } from '../templates/event.template';
import { CharacterTemplateVariables } from '../templates/character.template';

/**
 * Enum for register section names
 */
export enum RegisterSection {
    Events = 'events',
    Characters = 'characters',
    SideCharacters = 'sideCharacters',
    Locations = 'locations',
    Passages = 'passages',
    Happenings = 'happenings'
}

/**
 * Manages adding items to the register.ts file
 * Handles both import statements and register object entries
 */
export class RegisterFileManager {
    private registerPath: string;

    constructor() {
        this.registerPath = registerFilePath();
    }

    /**
     * Adds an event to the register
     * @param eventId The ID of the event (e.g., 'wedding')
     * @param eventFilePath The relative path to the event file from the register file
     */
    public async addEventToRegister(eventId: string, eventFilePath: string): Promise<void> {
        const eventVariables = new EventTemplateVariables(eventId);
        
        await this.addItemToRegister({
            itemId: eventId,
            itemFilePath: eventFilePath,
            sectionName: RegisterSection.Events,
            importName: eventVariables.mainEventFunction,
            variableName: eventVariables.mainEventFunction
        });
    }

    /**
     * Adds a character to the register
     * @param characterId The ID of the character (e.g., 'thomas')
     * @param characterFilePath The relative path to the character file from the register file
     */
    public async addCharacterToRegister(characterId: string, characterFilePath: string): Promise<void> {
        const characterVariables = new CharacterTemplateVariables(characterId);
        
        await this.addItemToRegister({
            itemId: characterId,
            itemFilePath: characterFilePath,
            sectionName: RegisterSection.Characters,
            importName: characterVariables.mainCharacterFunction,
            variableName: characterVariables.mainCharacterFunction
        });
    }

    /**
     * Adds a side character to the register
     * @param characterId The ID of the side character (e.g., 'franta')
     * @param characterFilePath The relative path to the character file from the register file
     */
    public async addSideCharacterToRegister(characterId: string, characterFilePath: string): Promise<void> {
        const capitalizedName = this.capitalizeFirstLetter(characterId);
        await this.addItemToRegister({
            itemId: characterId,
            itemFilePath: characterFilePath,
            sectionName: RegisterSection.SideCharacters,
            importName: capitalizedName,
            variableName: capitalizedName
        });
    }

    /**
     * Adds a location to the register
     * @param locationId The ID of the location (e.g., 'village')
     * @param locationFilePath The relative path to the location file from the register file
     */
    public async addLocationToRegister(locationId: string, locationFilePath: string): Promise<void> {
        await this.addItemToRegister({
            itemId: locationId,
            itemFilePath: locationFilePath,
            sectionName: RegisterSection.Locations,
            importName: `${locationId}Location`,
            variableName: `${locationId}Location`
        });
    }

    /**
     * Adds a passage to the register
     * @param passageId The ID of the passage (e.g., 'wedding')
     * @param passageFilePath The relative path to the passage file from the register file (without extension)
     * @param eventId Optional event ID for template variables (if not provided, uses passageId)
     * @param characterId Optional character ID for template variables (if not provided, uses 'default')
     */
    public async addPassageToRegister(
        passageId: string, 
        passageFilePath: string, 
        eventId?: string, 
        characterId?: string
    ): Promise<void> {
        // For passages, we still use dynamic imports but can optionally use template variables
        // if eventId and characterId are provided
        const importValue = `() => import('${passageFilePath}')`;
        
        await this.addItemToRegister({
            itemId: passageId,
            itemFilePath: '', // No import needed for dynamic imports
            sectionName: RegisterSection.Passages,
            importName: '', // No import needed
            variableName: importValue,
            skipImport: true
        });
    }

    /**
     * Adds a happening to the register
     * @param happeningId The ID of the happening (e.g., 'village_under_attack')
     * @param happeningFilePath The relative path to the happening file from the register file
     */
    public async addHappeningToRegister(happeningId: string, happeningFilePath: string): Promise<void> {
        await this.addItemToRegister({
            itemId: happeningId,
            itemFilePath: happeningFilePath,
            sectionName: RegisterSection.Happenings,
            importName: `${happeningId}Happening`,
            variableName: `${happeningId}Happening`
        });
    }

    /**
     * Generic method to add an item to any section of the register
     */
    private async addItemToRegister(options: {
        itemId: string;
        itemFilePath: string;
        sectionName: RegisterSection;
        importName: string;
        variableName: string;
        skipImport?: boolean;
    }): Promise<void> {
        const { itemId, itemFilePath, sectionName, importName, variableName, skipImport = false } = options;

        try {
            // Load the register file
            const content = config.fileSystem.readFileSync(this.registerPath, 'utf-8');
            const codeBuilder = new TypeScriptCodeBuilder(content);

            // Add import statement (if not skipped)
            if (!skipImport && itemFilePath && importName) {
                await this.addImportStatement(codeBuilder, importName, itemFilePath);
            }

            // Add entry to the register object
            await this.addToRegisterObject(codeBuilder, sectionName, itemId, variableName);

            // Save the changes
            const updatedContent = await codeBuilder.toString();
            config.fileSystem.writeFileSync(this.registerPath, updatedContent, 'utf-8');

            config.editorAdapter.showInformationNotification(
                `Successfully added ${itemId} to ${sectionName} in register.`
            );

        } catch (error) {
            const errorMessage = `Failed to add ${itemId} to register: ${error instanceof Error ? error.message : String(error)}`;
            config.editorAdapter.showErrorNotification(errorMessage);
            console.error(errorMessage, error);
            throw error;
        }
    }

    /**
     * Adds an import statement to the top of the file
     */
    private async addImportStatement(codeBuilder: TypeScriptCodeBuilder, importName: string, importPath: string): Promise<void> {
        codeBuilder.insertCodeAtIndex(0, `import { ${importName} } from '${importPath}';\n`);
    }

    /**
     * Adds an entry to the specified section of the register object
     */
    private async addToRegisterObject(
        codeBuilder: TypeScriptCodeBuilder, 
        sectionName: RegisterSection, 
        itemId: string, 
        variableName: string
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Find the register object
            codeBuilder.findObject('register', {
                onFound: (registerBuilder) => {
                    // Find the specific section (e.g., 'events', 'characters', etc.)
                    registerBuilder.findObject(sectionName, {
                        onFound: (sectionBuilder) => {
                            // Add the new item to the section
                            sectionBuilder.setPropertyValue(itemId, variableName);
                            resolve();
                        },
                        onNotFound: () => {
                            reject(new Error(`Section '${sectionName}' not found in register object`));
                        }
                    });
                },
                onNotFound: () => {
                    reject(new Error('Register object not found in file'));
                }
            });
        });
    }

    /**
     * Helper method to capitalize the first letter of a string
     */
    private capitalizeFirstLetter(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Checks if an item already exists in the register
     */
    public async checkIfItemExists(sectionName: RegisterSection, itemId: string): Promise<boolean> {
        try {
            const content = config.fileSystem.readFileSync(this.registerPath, 'utf-8');
            const codeBuilder = new TypeScriptCodeBuilder(content);

            return new Promise<boolean>((resolve) => {
                codeBuilder.findObject('register', {
                    onFound: (registerBuilder) => {
                        registerBuilder.findObject(sectionName, {
                            onFound: (sectionBuilder) => {
                                // Check if the property exists
                                const properties = (sectionBuilder as any).parseProperties();
                                const exists = properties.some((prop: any) => prop.name === itemId);
                                resolve(exists);
                            },
                            onNotFound: () => {
                                resolve(false);
                            }
                        });
                    },
                    onNotFound: () => {
                        resolve(false);
                    }
                });
            });
        } catch (error) {
            console.error('Error checking if item exists:', error);
            return false;
        }
    }

    /**
     * Removes an item from the register
     */
    public async removeFromRegister(sectionName: RegisterSection, itemId: string): Promise<void> {
        try {
            const content = config.fileSystem.readFileSync(this.registerPath, 'utf-8');
            const codeBuilder = new TypeScriptCodeBuilder(content);

            return new Promise<void>((resolve, reject) => {
                codeBuilder.findObject('register', {
                    onFound: (registerBuilder) => {
                        registerBuilder.findObject(sectionName, {
                            onFound: (sectionBuilder) => {
                                const success = sectionBuilder.removeProperty(itemId);
                                if (success) {
                                    // Save the changes
                                    codeBuilder.toString().then(updatedContent => {
                                        config.fileSystem.writeFileSync(this.registerPath, updatedContent, 'utf-8');
                                        resolve();
                                    });
                                } else {
                                    reject(new Error(`Item '${itemId}' not found in section '${sectionName}'`));
                                }
                            },
                            onNotFound: () => {
                                reject(new Error(`Section '${sectionName}' not found in register object`));
                            }
                        });
                    },
                    onNotFound: () => {
                        reject(new Error('Register object not found in file'));
                    }
                });
            });
        } catch (error) {
            const errorMessage = `Failed to remove ${itemId} from register: ${error instanceof Error ? error.message : String(error)}`;
            config.editorAdapter.showErrorNotification(errorMessage);
            console.error(errorMessage, error);
            throw error;
        }
    }
}

export const registerFileManager = new RegisterFileManager();