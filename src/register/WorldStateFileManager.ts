import path from 'path';
import { worldStateFilePath } from '../Paths';
import { config } from '../WFServerConfig';
import { TypeScriptCodeBuilder } from '../typescriptObjectParser/ObjectParser';
import { ChapterTemplateVariables } from '../templates/chapter.template';
import { CharacterTemplateVariables } from '../templates/character.template';

/**
 * Enum for world state section names
 */
export enum WorldStateSection {
    Characters = 'characters',
    SideCharacters = 'sideCharacters',
    Chapters = 'chapters',
    Locations = 'locations',
    Happenings = 'happenings'
}

/**
 * Interface for type imports that need to be added
 */
interface TypeImport {
    typeName: string;
    importPath: string;
}

/**
 * Manages adding items to the TWorldState type definition
 * Handles both import statements and type property entries
 */
export class WorldStateFileManager {
    private worldStateFilePath: string;

    constructor() {
        this.worldStateFilePath = worldStateFilePath();
    }

    /**
     * Adds a character to the world state
     * @param characterId The ID of the character (e.g., 'thomas')
     * @param characterFilePath The relative path to the character file from the world state file
     */
    public async addCharacterToWorldState(characterId: string, characterFilePath: string): Promise<void> {
        const characterVariables = new CharacterTemplateVariables(characterId);
        const capitalizedId = this.capitalizeFirstLetter(characterId);

        // Import path should be relative and without extension
        const importPath = this.getRelativeImportPath(characterFilePath);

        const typeImports: TypeImport[] = [
            {
                typeName: `T${capitalizedId}CharacterData`,
                importPath: importPath
            }
        ];

        const typeDefinition = `${characterId}: { ref: TCharacter<'${characterId}'> } & TCharacterData & Partial<T${capitalizedId}CharacterData>;`;

        await this.addItemToWorldState({
            sectionName: WorldStateSection.Characters,
            itemId: characterId,
            typeDefinition,
            typeImports
        });
    }

    /**
     * Adds a side character to the world state
     * @param characterId The ID of the side character (e.g., 'franta')
     * @param characterFilePath The relative path to the character file from the world state file
     */
    public async addSideCharacterToWorldState(characterId: string, characterFilePath: string): Promise<void> {
        const capitalizedId = this.capitalizeFirstLetter(characterId);
        const importPath = this.getRelativeImportPath(characterFilePath);

        const typeImports: TypeImport[] = [
            {
                typeName: `T${capitalizedId}SideCharacterData`,
                importPath: importPath
            }
        ];

        const typeDefinition = `${characterId}: { ref: TSideCharacter<'${characterId}'> } & TSideCharacterData & Partial<T${capitalizedId}SideCharacterData>;`;

        await this.addItemToWorldState({
            sectionName: WorldStateSection.SideCharacters,
            itemId: characterId,
            typeDefinition,
            typeImports
        });
    }

    /**
     * Adds an chapter to the world state
     * @param chapterId The ID of the chapter (e.g., 'wedding')
     * @param chapterFilePath The relative path to the chapter file from the world state file
     */
    public async addChapterToWorldState(chapterId: string, chapterFilePath: string): Promise<void> {
        const capitalizedId = this.capitalizeFirstLetter(chapterId);
        const importPath = this.getRelativeImportPath(chapterFilePath);

        const typeImports: TypeImport[] = [
            {
                typeName: `T${capitalizedId}ChapterData`,
                importPath: importPath
            }
        ];

        const typeDefinition = `${chapterId}: { ref: TChapter<'${chapterId}'> } & T${capitalizedId}ChapterData;`;

        await this.addItemToWorldState({
            sectionName: WorldStateSection.Chapters,
            itemId: chapterId,
            typeDefinition,
            typeImports
        });
    }

    /**
     * Adds a location to the world state
     * @param locationId The ID of the location (e.g., 'village')
     * @param locationFilePath The relative path to the location file from the world state file
     * @param isPartial Whether the location data should be marked as Partial (default: false)
     */
    public async addLocationToWorldState(locationId: string, locationFilePath: string, isPartial: boolean = false): Promise<void> {
        const capitalizedId = this.capitalizeFirstLetter(locationId);
        const importPath = this.getRelativeImportPath(locationFilePath);

        const typeImports: TypeImport[] = [
            {
                typeName: `T${capitalizedId}LocationData`,
                importPath: importPath
            }
        ];

        const partialWrapper = isPartial ? 'Partial<' : '';
        const partialClose = isPartial ? '>' : '';
        const typeDefinition = `${locationId}: { ref: TLocation<'${locationId}'> } & ${partialWrapper}T${capitalizedId}LocationData${partialClose};`;

        await this.addItemToWorldState({
            sectionName: WorldStateSection.Locations,
            itemId: locationId,
            typeDefinition,
            typeImports
        });
    }

    /**
     * Adds a happening to the world state
     * @param happeningId The ID of the happening (e.g., 'village_under_attack')
     */
    public async addHappeningToWorldState(happeningId: string): Promise<void> {
        const typeDefinition = `${happeningId}: { ref: THappening<'${happeningId}'> };`;

        await this.addItemToWorldState({
            sectionName: WorldStateSection.Happenings,
            itemId: happeningId,
            typeDefinition,
            typeImports: [] // Happenings typically don't need additional imports
        });
    }

    /**
     * Generic method to add an item to any section of the world state
     */
    private async addItemToWorldState(options: {
        sectionName: WorldStateSection;
        itemId: string;
        typeDefinition: string;
        typeImports: TypeImport[];
    }): Promise<void> {
        const { sectionName, itemId, typeDefinition, typeImports } = options;

        try {
            const content = config.fileSystem.readFileSync(this.worldStateFilePath, 'utf-8');

            // --- START OF CRITICAL LOGGING ---
            console.log("\n\n<<<<<<<<<<<<<<<<<< START WORLD STATE DEBUG >>>>>>>>>>>>>>>>>>");
            console.log(`[WORLD STATE] Modifying file: ${this.worldStateFilePath}`);
            console.log(`[WORLD STATE] Adding item '${itemId}' to section '${sectionName}'.`);
            console.log("[WORLD STATE] --- Initial File Content ---");
            console.log(content);
            console.log("[WORLD STATE] --- End of Initial File Content ---\n");
            // --- END OF CRITICAL LOGGING ---

            const codeBuilder = new TypeScriptCodeBuilder(content);

            for (const typeImport of typeImports) {
                await this.addImportStatement(codeBuilder, typeImport.typeName, typeImport.importPath);
            }

            await this.addToWorldStateType(codeBuilder, sectionName, itemId, typeDefinition);

            const updatedContent = await codeBuilder.toString();

            // --- MORE CRITICAL LOGGING ---
            console.log("\n[WORLD STATE] --- Final Generated Content ---");
            console.log(updatedContent);
            console.log("[WORLD STATE] --- End of Final Generated Content ---");
            console.log("<<<<<<<<<<<<<<<<<< END WORLD STATE DEBUG >>>>>>>>>>>>>>>>>>\n\n");
            // --- END OF MORE CRITICAL LOGGING ---

            config.fileSystem.writeFileSync(this.worldStateFilePath, updatedContent, 'utf-8');

            config.editorAdapter.showInformationNotification(
                `Successfully added ${itemId} to ${sectionName} in TWorldState.`
            );

        } catch (error) {
            const errorMessage = `Failed to add ${itemId} to world state: ${error instanceof Error ? error.message : String(error)}`;
            config.editorAdapter.showErrorNotification(errorMessage);
            console.error(errorMessage, error);
            throw error;
        }
    }

    /**
     * Adds an import statement to the top of the file using the enhanced import manager
     */
    private async addImportStatement(codeBuilder: TypeScriptCodeBuilder, typeName: string, importPath: string): Promise<void> {
        const importManager = codeBuilder.getImportManager();

        if (!importManager.hasNamedImport(typeName, importPath)) {
            importManager.addNamedImport(typeName, importPath);
        }
    }

    /**
     * Adds an entry to the specified section of the TWorldState type using enhanced type support
     */
    private async addToWorldStateType(
        codeBuilder: TypeScriptCodeBuilder,
        sectionName: WorldStateSection,
        itemId: string,
        typeDefinition: string
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            codeBuilder.findTypeDeclaration('TWorldState', {
                onFound: (typeBuilder) => {
                    typeBuilder.findNestedTypeObject([sectionName], {
                        onFound: (sectionBuilder) => {
                            // Check if item already exists
                            if (sectionBuilder.hasProperty(itemId)) {
                                console.warn(`Item '${itemId}' already exists in section '${sectionName}'`);
                                resolve();
                                return;
                            }

                            // Parse the type definition to extract the type
                            const typeMatch = typeDefinition.match(/:\s*(.+);$/);
                            if (typeMatch) {
                                const propertyType = typeMatch[1].trim();
                                sectionBuilder.addProperty(itemId, propertyType);
                            } else {
                                // Fallback to manual insertion if parsing fails
                                throw new Error(`Failed to parse type definition for ${itemId} in section ${sectionName}`);
                            }
                            resolve();
                        },
                        onNotFound: () => {
                            reject(new Error(`Section '${sectionName}' not found in TWorldState type`));
                        }
                    });
                },
                onNotFound: () => {
                    reject(new Error('TWorldState type declaration not found'));
                }
            });
        });
    }

    /**
     * Checks if an item already exists in the world state using enhanced type support
     */
    public async checkIfItemExists(sectionName: WorldStateSection, itemId: string): Promise<boolean> {
        try {
            const content = config.fileSystem.readFileSync(this.worldStateFilePath, 'utf-8');
            const codeBuilder = new TypeScriptCodeBuilder(content);

            return new Promise<boolean>((resolve) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder) => {
                        typeBuilder.findNestedTypeObject([sectionName], {
                            onFound: (sectionBuilder) => {
                                resolve(sectionBuilder.hasProperty(itemId));
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
     * Removes an item from the world state using enhanced type support
     */
    public async removeFromWorldState(sectionName: WorldStateSection, itemId: string): Promise<void> {
        try {
            const content = config.fileSystem.readFileSync(this.worldStateFilePath, 'utf-8');
            const codeBuilder = new TypeScriptCodeBuilder(content);

            return new Promise<void>((resolve, reject) => {
                codeBuilder.findTypeDeclaration('TWorldState', {
                    onFound: (typeBuilder) => {
                        typeBuilder.findNestedTypeObject([sectionName], {
                            onFound: (sectionBuilder) => {
                                const success = sectionBuilder.removeProperty(itemId);
                                if (success) {
                                    // Save the changes
                                    codeBuilder.toString().then(updatedContent => {
                                        config.fileSystem.writeFileSync(this.worldStateFilePath, updatedContent, 'utf-8');

                                        config.editorAdapter.showInformationNotification(
                                            `Successfully removed ${itemId} from ${sectionName} in TWorldState.`
                                        );
                                        resolve();
                                    });
                                } else {
                                    reject(new Error(`Item '${itemId}' not found in section '${sectionName}'`));
                                }
                            },
                            onNotFound: () => {
                                reject(new Error(`Section '${sectionName}' not found in TWorldState type`));
                            }
                        });
                    },
                    onNotFound: () => {
                        reject(new Error('TWorldState type declaration not found'));
                    }
                });
            });

        } catch (error) {
            const errorMessage = `Failed to remove ${itemId} from world state: ${error instanceof Error ? error.message : String(error)}`;
            config.editorAdapter.showErrorNotification(errorMessage);
            console.error(errorMessage, error);
            throw error;
        }
    }

    /**
     * Helper method to capitalize the first letter of a string
     */
    private capitalizeFirstLetter(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Helper method to convert file path to relative import path
     */
    private getRelativeImportPath(filePath: string): string {
        // Remove file extension and convert to relative path
        const relativePath = path.relative(path.dirname(this.worldStateFilePath), filePath);
        const cleanPath = relativePath.replace(/\.(ts|js)$/, '').replace(/\\/g, '/');

        // Ensure relative imports start with './' if they don't start with '../'
        if (!cleanPath.startsWith('./') && !cleanPath.startsWith('../')) {
            return './' + cleanPath;
        }

        return cleanPath;
    }
}

export const worldStateFileManager = new WorldStateFileManager();