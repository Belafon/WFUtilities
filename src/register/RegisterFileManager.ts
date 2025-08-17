import path from 'path';
import { getImportToChapterPassagesFile, registerFilePath } from '../Paths';
import { config } from '../WFServerConfig';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';
import { ChapterTemplateVariables } from '../templates/chapter.template';
import { CharacterTemplateVariables } from '../templates/character.template';

/**
 * Enum for register section names
 */
export enum RegisterSection {
    Chapters = 'chapters',
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
     * Adds an chapter to the register
     * @param chapterId The ID of the chapter (e.g., 'wedding')
     * @param chapterFilePath The relative path to the chapter file from the register file
     */
    public async addChapterToRegister(chapterId: string, chapterFilePath: string): Promise<void> {
        const chapterVariables = new ChapterTemplateVariables(chapterId);

        await this.addItemToRegister({
            itemId: chapterId,
            itemFilePath: chapterFilePath,
            sectionName: RegisterSection.Chapters,
            importName: chapterVariables.mainChapterFunction,
            variableName: chapterVariables.mainChapterFunction
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
     * @param chapterId Optional chapter ID for template variables (if not provided, uses passageId)
     * @param characterId Optional character ID for template variables (if not provided, uses 'default')
     */
    public async addPassageToRegister(
        passageId: string,
        passageFilePath: string,
        chapterId?: string,
        characterId?: string
    ): Promise<void> {
        // For passages, we still use dynamic imports but can optionally use template variables
        // if chapterId and characterId are provided
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
            const content = config.fileSystem.readFileSync(this.registerPath, 'utf-8');

            // --- START OF CRITICAL LOGGING ---
            console.log("\n\n<<<<<<<<<<<<<<<<<< START REGISTER DEBUG >>>>>>>>>>>>>>>>>>");
            console.log(`[REGISTER] Modifying file: ${this.registerPath}`);
            console.log(`[REGISTER] Adding item '${itemId}' to section '${sectionName}'.`);
            console.log("[REGISTER] --- Initial File Content ---");
            console.log(content);
            console.log("[REGISTER] --- End of Initial File Content ---\n");
            // --- END OF CRITICAL LOGGING ---

            const codeBuilder = new TypeScriptCodeBuilder(content);

            if (!skipImport && itemFilePath && importName) {
                // Using the helper method to ensure the path is relative
                const relativePath = this.getRelativeImportPath(itemFilePath);
                await this.addImportStatement(codeBuilder, importName, relativePath);
            }

            await this.addToRegisterObject(codeBuilder, sectionName, itemId, variableName);

            const updatedContent = await codeBuilder.toString();

            // --- MORE CRITICAL LOGGING ---
            console.log("\n[REGISTER] --- Final Generated Content ---");
            console.log(updatedContent);
            console.log("[REGISTER] --- End of Final Generated Content ---");
            console.log("<<<<<<<<<<<<<<<<<< END REGISTER DEBUG >>>>>>>>>>>>>>>>>>\n\n");
            // --- END OF MORE CRITICAL LOGGING ---

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
        // Get the specialized manager for handling imports.
        const importManager = codeBuilder.getImportManager();

        // Use the manager's method to add the named import.
        // This is idempotent (won't add a duplicate) and handles formatting correctly.
        importManager.addNamedImport(importName, importPath);
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
                    // Find the specific section (e.g., 'chapters', 'characters', etc.)
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

                    if(sectionName === RegisterSection.Chapters) {
                        // Add import into passages
                        registerBuilder.findObject('passages', {
                            onFound: (passagesBuilder) => {
                                passagesBuilder.setPropertyValue(itemId, `() => ${getImportToChapterPassagesFile(itemId)}`);
                            },
                            onNotFound: () => {
                                reject(new Error(`Passages section not found in register object`));
                            }
                        });
                    }
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

    private getRelativeImportPath(filePath: string): string {
        // Remove file extension and convert to relative path
        const relativePath = path.relative(path.dirname(this.registerPath), filePath);
        const cleanPath = relativePath.replace(/\.(ts|js)$/, '').replace(/\\/g, '/');

        // Ensure relative imports start with './' if they don't start with '../'
        if (!cleanPath.startsWith('./') && !cleanPath.startsWith('../')) {
            return './' + cleanPath;
        }

        return cleanPath;
    }
}

export const registerFileManager = new RegisterFileManager();