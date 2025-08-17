import path from 'path'; // Ensure path is imported
import {
  ScreenPassageUpdateRequest,
  TLinkCostObjectUpdateRequest,
  TLinkCostUpdateRequest,
  TPassageScreenBodyItemUpdateRequest,
  TLinkUpdateRequest,
} from '../../types'; // Adjust path as necessary
import { chaptersDir, chapterPassagesFilePostfixWithoutFileType as chapterPassagesFilePostfixWithoutFileType, passageFilePostfix, passageFilePostfixScreen, passageFilePostfixTransition, passageFilePostfixLinear } from '../../Paths';
import { DefaultEditorAdapter, EditorAdapter } from '../adapters/editorAdapter';
import { TokenGroup, TypeScriptCodeBuilder } from '../../typescriptObjectParser/ObjectParser';
import { TypeScriptObjectBuilder } from "../../typescriptObjectParser/TypeScriptObjectBuilder";
// Assuming CodeLiteral and ObjectToStringConverter are in this path or similar
import { CodeLiteral, ObjectToStringConverter } from '../../utils/objectToStringConverter';
import { config } from '../../WFServerConfig';

type TPassageType = 'screen' | 'linear' | 'transition';

function validatePassageId(passageId: string): [string, string, string] | null {
  const parts = passageId.split('-');

  if (parts.length !== 3 || !parts.every(p => p.length > 0)) {
    console.error(`Invalid passageId format: ${passageId}. Expected 3 hyphen-separated, non-empty parts (e.g., chapterName-characterName-passageName).`);
    return null;
  }

  if (parts[1].toLowerCase() === 'id') {
    console.error(`Invalid passageId format: ${passageId}. The characterId part (second segment) cannot be 'id'.`);
    return null;
  }

  return parts as [string, string, string];
}

/**
 * Passage Manager Service
 * Handles business logic for passage operations
 */
export class PassageManager {
  private _editorAdapter?: EditorAdapter;
  private objectConverter: ObjectToStringConverter;

  constructor(editorAdapter?: EditorAdapter) {
    this._editorAdapter = editorAdapter;
    this.objectConverter = new ObjectToStringConverter('  '); // Configure desired indent
  }

  private get editorAdapter(): EditorAdapter {
    return this._editorAdapter || config.editorAdapter;
  }

  public async updatePassage(passageId: string, passageData: ScreenPassageUpdateRequest): Promise<void> {
    const parts = validatePassageId(passageId);
    if (!parts) {
      const errorMessage = `Invalid passageId format: ${passageId}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    const [chapterId, characterId, passagePartId] = parts;

    const resolvedPassageFilePath = this.resolvePassageFilePath(chapterId, characterId, passagePartId);

    const originalContent = config.fileSystem.readFileSync(resolvedPassageFilePath, 'utf-8');
    const codeBuilder = new TypeScriptCodeBuilder(originalContent);

    let passageObjectBuilder: TypeScriptObjectBuilder | null = null;

    // Try multiple patterns to find the passage
    const patterns = [
      `${passagePartId}Passage`,
      passagePartId,
      `${passagePartId}`,
      // Also try without 'Passage' suffix for cases like 'intro' -> 'introPassage'
      `${passagePartId.replace(/Passage$/, '')}Passage`,
    ];

    // First try to find as a function returning an object
    for (const pattern of patterns) {
      if (passageObjectBuilder) break;

      codeBuilder.findReturnObjectInFunction(pattern, {
        onFound: (objBuilder: TypeScriptObjectBuilder) => {
          passageObjectBuilder = objBuilder;
        },
        onNotFound: () => { }
      });
    }

    // If not found as function, try as a direct object
    if (!passageObjectBuilder) {
      for (const pattern of patterns) {
        if (passageObjectBuilder) break;

        codeBuilder.findObject(pattern, {
          onFound: (objBuilder: TypeScriptObjectBuilder) => {
            passageObjectBuilder = objBuilder;
          },
          onNotFound: () => { }
        });
      }
    }

    // Also try to find by searching for the return object directly in the content
    if (!passageObjectBuilder && originalContent.includes(`id: '${passagePartId}'`)) {
      // This is a fallback - create a simple regex-based search
      const objectMatch = originalContent.match(/return\s*{[^}]*id:\s*['"]([^'"]+)['"]/);
      if (objectMatch && objectMatch[1] === passagePartId) {
        // Found a return statement with the correct id
        // Try to extract the object bounds
        const returnIndex = originalContent.indexOf('return');
        if (returnIndex !== -1) {
          const afterReturn = originalContent.substring(returnIndex);
          const openBraceIndex = afterReturn.indexOf('{');
          if (openBraceIndex !== -1) {
            // Count braces to find the matching closing brace
            let braceCount = 0;
            let i = openBraceIndex;
            for (; i < afterReturn.length; i++) {
              if (afterReturn[i] === '{') braceCount++;
              else if (afterReturn[i] === '}') {
                braceCount--;
                if (braceCount === 0) break;
              }
            }

            if (braceCount === 0) {
              // Create a mock object group for the found object
              const objectGroup: TokenGroup = {
                type: 'ObjectLiteral',
                start: returnIndex + openBraceIndex,
                end: returnIndex + i + 1,
                tokens: [],
                children: [],
                metadata: {}
              };
              passageObjectBuilder = new TypeScriptObjectBuilder(codeBuilder, objectGroup, originalContent);
            }
          }
        }
      }
    }

    if (!passageObjectBuilder) {
      const errorMessage = `Could not find passage definition (object or function return) for '${passagePartId}' (tried patterns: ${patterns.join(', ')}) in ${resolvedPassageFilePath}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    const builder = passageObjectBuilder as TypeScriptObjectBuilder;

    builder.setPropertyValue('type', `'${passageData.type}'`);

    if (passageData.title !== undefined) {
      builder.setPropertyValue('title', this.formatStringForI18nCode(passageData.title));
    }

    if (passageData.image !== undefined) {
      builder.setPropertyValue('image', `'${passageData.image}'`);
    }

    if (passageData.type === 'screen') {
      if (passageData.body !== undefined) {
        const bodyObject = this.buildPassageBodyObjectStructure(passageData.body);
        const bodyString = this.objectConverter.convert(bodyObject, 2); // Initial indent level for body array
        builder.setPropertyValue('body', bodyString);
      }
    } else if (passageData.type === 'linear') {
      if (passageData.description !== undefined) {
        builder.setPropertyValue('description', this.formatStringForI18nCode(passageData.description));
      }
      if (passageData.nextPassageId !== undefined) {
        builder.setPropertyValue('nextPassageId', `'${passageData.nextPassageId}'`);
      }
    } else if (passageData.type === 'transition') {
      if (passageData.nextPassageId !== undefined) {
        builder.setPropertyValue('nextPassageId', `'${passageData.nextPassageId}'`);
      }
    }

    const updatedContent = await codeBuilder.toString();
    config.fileSystem.writeFileSync(resolvedPassageFilePath, updatedContent, 'utf-8');
  }

  private formatStringForI18nCode(value: string): string {
    const trimmedValue = value.trim();
    if (trimmedValue.startsWith("_(") && trimmedValue.endsWith(")")) {
      const inner = trimmedValue.substring(2, trimmedValue.length - 1).trim();
      if ((inner.startsWith("'") && inner.endsWith("'")) || (inner.startsWith('"') && inner.endsWith('"'))) {
        return trimmedValue;
      }
    }
    if ((trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) || (trimmedValue.startsWith('"') && trimmedValue.endsWith('"'))) {
      const bareString = trimmedValue.substring(1, trimmedValue.length - 1);
      return `_('${bareString.replace(/'/g, "\\'")}')`;
    }
    return `_('${trimmedValue.replace(/'/g, "\\'")}')`;
  }

  private buildPassageBodyObjectStructure(bodyItems: TPassageScreenBodyItemUpdateRequest[]): any[] {
    return bodyItems.map(item => {
      const builtItem: any = {};

      if (item.condition !== undefined) {
        let conditionString: string;
        if (typeof item.condition === 'string') {
          conditionString = item.condition;
        } else if (typeof item.condition === 'boolean') {
          conditionString = String(item.condition);
        } else {
          console.warn(`Unexpected type for item.condition: ${typeof item.condition}. Converting to string.`);
          conditionString = String(item.condition);
        }
        builtItem.condition = new CodeLiteral(conditionString);
      }

      if (item.redirect !== undefined) {
        builtItem.redirect = item.redirect; // Raw string, converter will quote
      }

      if (item.text !== undefined) {
        builtItem.text = new CodeLiteral(this.formatStringForI18nCode(item.text));
      }

      if (item.links && item.links.length > 0) {
        builtItem.links = item.links.map(link => this.buildLinkObjectStructure(link));
      }

      for (const key in builtItem) {
        if (builtItem[key] === undefined) {
          delete builtItem[key];
        }
      }
      return builtItem;
    });
  }

  private buildLinkObjectStructure(link: TLinkUpdateRequest): any {
    const builtLink: any = {};
    if (link.text !== undefined) {
      // formatStringForI18nCode returns a string like "_('My Text')" which is valid JS code
      builtLink.text = new CodeLiteral(this.formatStringForI18nCode(link.text));
    }
    if (link.passageId !== undefined) {
      // passageId is a string value like "next-passage", converter will make it "'next-passage'"
      builtLink.passageId = link.passageId;
    }
    if (link.autoPriority !== undefined) {
      builtLink.autoPriority = link.autoPriority; // Boolean or number, converter handles
    }
    if (link.cost !== undefined) {
      builtLink.cost = this.buildLinkCostObjectStructure(link.cost);
    }

    // Clean up undefined properties
    for (const key in builtLink) {
      if (builtLink[key] === undefined) {
        delete builtLink[key];
      }
    }
    return builtLink;
  }

  private buildLinkCostObjectStructure(cost: TLinkCostUpdateRequest): any {
    if ('value' in cost && 'unit' in cost && typeof cost.value === 'number' && typeof cost.unit === 'string') {
      const unit = cost.unit.toLowerCase();
      if (unit === 'min') return new CodeLiteral(`DeltaTime.fromMin(${cost.value})`);
      if (unit === 'hour') return new CodeLiteral(`DeltaTime.fromHours(${cost.value})`);
      if (unit === 'day') return new CodeLiteral(`DeltaTime.fromDays(${cost.value})`);

      console.warn(`Unknown DeltaTime unit for cost: ${cost.unit}. Falling back to object representation.`);
      // For the object fallback, ObjectToStringConverter will handle quoting string values.
      return { value: cost.value, unit: cost.unit }; // unit is raw string
    } else {
      const objCost = cost as TLinkCostObjectUpdateRequest;
      const builtCost: any = {};
      if (objCost.time) {
        builtCost.time = this.buildLinkCostObjectStructure(objCost.time);
      }
      if (objCost.items && objCost.items.length > 0) {
        // items: [{ id: 'gold', amount: 100 }] -> converter produces items: [ { id: 'gold', amount: 100 } ]
        builtCost.items = objCost.items.map(ci => ({
          id: ci.id, // Raw string, e.g., "gold"
          amount: ci.amount
        }));
      }
      if (objCost.tools && objCost.tools.length > 0) {
        // tools: ['rope', 'torch'] -> converter produces tools: [ 'rope', 'torch' ]
        builtCost.tools = objCost.tools; // Array of raw strings
      }
      return builtCost;
    }
  }

  public async deletePassage(passageId: string): Promise<void> {
    const parts = validatePassageId(passageId);
    if (!parts) {
      const errorMessage = `Invalid passageId format: ${passageId}. Expected format: chapterId-characterId-passagePartId`;
      this.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    const [chapterId, characterId, passagePartId] = parts;

    const resolvedPassageFilePath = this.resolvePassageFilePath(chapterId, characterId, passagePartId);

    try {
      config.fileSystem.unlinkSync(resolvedPassageFilePath);
      this.editorAdapter.showInformationNotification(`Passage file ${resolvedPassageFilePath} deleted successfully.`);
      console.log(`Passage file ${resolvedPassageFilePath} deleted successfully.`);
    } catch (error) {
      console.error(`Error deleting passage file ${resolvedPassageFilePath}:`, error);
      const errorMessage = `Failed to delete passage file: ${error instanceof Error ? error.message : String(error)}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      throw error;
    }
  }

  public async openScreenPassage(passageId: string): Promise<void> {
    const parts = validatePassageId(passageId);
    if (!parts) {
      const errorMessage = `Invalid passageId format: ${passageId}. Expected format: chapterId-characterId-passagePartId`;
      this.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }
    const [chapterId, characterId, passagePartId] = parts;

    const resolvedPassageFilePath = this.resolvePassageFilePath(chapterId, characterId, passagePartId);

    try {
      await this.editorAdapter.openFile(resolvedPassageFilePath);
      console.log(`Attempted to open passage file: ${resolvedPassageFilePath}`);
    } catch (error) {
      console.error(`Error opening passage file ${resolvedPassageFilePath}:`, error);
      const errorMessage = `Failed to open passage file ${resolvedPassageFilePath}: ${error instanceof Error ? error.message : String(error)}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      throw error;
    }
  }

  private resolvePassageFilePath(
    chapterId: string,
    characterId: string,
    passagePartId: string,
  ): string {

    const primaryPassageParentDir = path.join(
      chaptersDir(),
      chapterId,
      `${characterId}${chapterPassagesFilePostfixWithoutFileType}`
    );

    const possiblePaths = [
      path.join(primaryPassageParentDir, `${passagePartId}${passageFilePostfixScreen}`),
      path.join(primaryPassageParentDir, `${passagePartId}${passageFilePostfixTransition}`),
      path.join(primaryPassageParentDir, `${passagePartId}${passageFilePostfixLinear}`),
      path.join(primaryPassageParentDir, `${passagePartId}${passageFilePostfix}`),
    ];

    for (const filePath of possiblePaths) {
      if (config.fileSystem.existsSync(filePath)) {
        return filePath;
      }
    }

    const errorMessage = `Passage file not found for passageId '${passagePartId}' in chapter '${chapterId}' and character '${characterId}'. Tried paths: ${possiblePaths.join(', ')}`;
    this.editorAdapter.showErrorNotification(errorMessage);
    throw new Error(errorMessage);
  }
}

export const passageManager = new PassageManager();