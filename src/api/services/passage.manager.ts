import path from 'path';
import {
  PassageUpdateRequest,
  TLinkCostObjectUpdateRequest,
  TLinkCostUpdateRequest,
  TPassageScreenBodyItemUpdateRequest
} from '../../types'; // Adjust path as necessary
import { eventsDir, evnetPassagesFilePostfixWithoutFileType, passageFilePostfix } from '../../Paths';
import { fileSystem } from '../adapters/fileSystem';
import { EditorAdapter as editorAdapter, DefaultEditorAdapter, EditorAdapter } from '../adapters/editorAdapter';
import { TypeScriptCodeBuilder, TypeScriptObjectBuilder } from '../../typescriptObjectParser/ObjectParser';

// Placeholder for a utility function that validates and splits the passageId.
// Example: "eventA-charB-passageC" -> ["eventA", "charB", "passageC"]
function validatePassageId(passageId: string): [string, string, string] | null {
  const parts = passageId.split('-');
  if (parts.length === 3 && parts.every(p => p.length > 0)) {
    return parts as [string, string, string];
  }
  console.error(`Invalid passageId format: ${passageId}. Expected eventId-characterId-passagePartId.`);
  return null;
}

/**
 * Passage Manager Service
 * Handles business logic for passage operations
 */
export class PassageManager {
  private editorAdapter: EditorAdapter;

  constructor(editorAdapter: EditorAdapter = new DefaultEditorAdapter()) {
    this.editorAdapter = editorAdapter;
  }

  /**
   * Updates a passage with the provided data
   * @param passageId The ID of the passage to update
   * @param passageData The data to update the passage with
   */
  public async updatePassage(passageId: string, passageData: PassageUpdateRequest): Promise<void> {
    const parts = validatePassageId(passageId);
    if (!parts) {
      throw new Error(`Invalid passageId format: ${passageId}`);
    }
    const [eventId, characterId, passagePartId] = parts;

    const primaryPassageParentDir = path.join(
      eventsDir(),
      eventId,
      `${characterId}${evnetPassagesFilePostfixWithoutFileType}`
    );
    const primaryPassageFilePath = path.join(
      primaryPassageParentDir,
      `${passagePartId}${passageFilePostfix}`
    );

    const alternativePassageParentDir = path.join(
        eventsDir(),
        eventId,
        characterId,
        'passages'
    );
    const alternativePassageFilePath = path.join(
        alternativePassageParentDir,
        `${passagePartId}${passageFilePostfix}`
    );
    
    let resolvedPassageFilePath = primaryPassageFilePath;
    if (!fileSystem.existsSync(resolvedPassageFilePath)) {
        if (fileSystem.existsSync(alternativePassageFilePath)) {
            resolvedPassageFilePath = alternativePassageFilePath;
        } else {
            throw new Error(`Passage file not found at primary path ${primaryPassageFilePath} or alternative path ${alternativePassageFilePath}`);
        }
    }

    const originalContent = fileSystem.readFileSync(resolvedPassageFilePath, 'utf-8');
    const codeBuilder = new TypeScriptCodeBuilder(originalContent);

    let passageObjectBuilder: TypeScriptObjectBuilder | null = null;
    
    const funcNamePattern = `${passagePartId}Passage`; 
    const varNamePattern = passagePartId;          

    codeBuilder.findReturnObjectInFunction(funcNamePattern, {
        onFound: (objBuilder: TypeScriptObjectBuilder) => { passageObjectBuilder = objBuilder; },
        onNotFound: () => {}
    });

    if (!passageObjectBuilder) {
        codeBuilder.findObject(funcNamePattern, {
            onFound: (objBuilder: TypeScriptObjectBuilder) => { passageObjectBuilder = objBuilder; },
            onNotFound: () => {}
        });
    }
    
    if (!passageObjectBuilder) {
        codeBuilder.findObject(varNamePattern, {
            onFound: (objBuilder: TypeScriptObjectBuilder) => { passageObjectBuilder = objBuilder; },
            onNotFound: () => {}
        });
    }

    if (!passageObjectBuilder) {
      throw new Error(`Could not find passage definition (object or function return) for '${passagePartId}' (tried patterns: ${funcNamePattern}, ${varNamePattern}) in ${resolvedPassageFilePath}`);
    }

    // After the throw, TypeScript should understand passageObjectBuilder is not null.
    // However, if it's still inferring 'never', we assert the type.
    // Assign to a new const with an explicit assertion for clarity.
    const builder = passageObjectBuilder as TypeScriptObjectBuilder;

    // Update properties based on passageData
    builder.setPropertyValue('type', `'${passageData.type}'`);

    if (passageData.title !== undefined) {
      builder.setPropertyValue('title', this.formatStringForI18nCode(passageData.title));
    }

    if (passageData.image !== undefined) {
      builder.setPropertyValue('image', `'${passageData.image}'`); 
    }

    if (passageData.type === 'screen') {
      if (passageData.body !== undefined) {
        const bodyString = this.convertPassageBodyToString(passageData.body);
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
    fileSystem.writeFileSync(resolvedPassageFilePath, updatedContent, 'utf-8');
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

  private convertPassageBodyToString(bodyItems: TPassageScreenBodyItemUpdateRequest[]): string {
    const itemsStr = bodyItems.map(item => {
      let itemParts: string[] = [];
      if (item.condition !== undefined) {
        itemParts.push(`condition: ${item.condition}`);
      }
      if (item.redirect !== undefined) {
        itemParts.push(`redirect: '${item.redirect}'`);
      }
      if (item.text !== undefined) {
        itemParts.push(`text: ${this.formatStringForI18nCode(item.text)}`);
      }
      if (item.links && item.links.length > 0) {
        const linksStr = item.links.map(link => {
          let linkParts: string[] = [];
          if (link.text !== undefined) {
            linkParts.push(`text: ${this.formatStringForI18nCode(link.text)}`);
          }
          if (link.passageId !== undefined) {
            linkParts.push(`passageId: '${link.passageId}'`);
          }
          if (link.autoPriority !== undefined) { 
            linkParts.push(`autoPriority: ${link.autoPriority}`); 
          }
          if (link.cost !== undefined) {
            linkParts.push(`cost: ${this.convertLinkCostToString(link.cost)}`);
          }
          linkParts = linkParts.filter(p => p); 
          return `{\n              ${linkParts.join(',\n              ')}\n            }`;
        }).join(',\n            ');
        itemParts.push(`links: [\n            ${linksStr}\n          ]`);
      }
      itemParts = itemParts.filter(p => p); 
      return `{\n        ${itemParts.join(',\n        ')}\n      }`;
    }).join(',\n      ');

    return `[\n      ${itemsStr}\n    ]`;
  }

  private convertLinkCostToString(cost: TLinkCostUpdateRequest): string {
    if ('value' in cost && 'unit' in cost && typeof cost.value === 'number' && typeof cost.unit === 'string') {
      const unit = cost.unit.toLowerCase();
      if (unit === 'min') return `DeltaTime.fromMin(${cost.value})`;
      if (unit === 'hour') return `DeltaTime.fromHours(${cost.value})`; 
      if (unit === 'day') return `DeltaTime.fromDays(${cost.value})`;   
      console.warn(`Unknown DeltaTime unit for cost: ${cost.unit}`);
      return '{}'; 
    } else {
      const objCost = cost as TLinkCostObjectUpdateRequest;
      let costParts: string[] = [];
      if (objCost.time) { 
        costParts.push(`time: ${this.convertLinkCostToString(objCost.time)}`); 
      }
      if (objCost.items && objCost.items.length > 0) {
        const itemsStr = objCost.items.map(ci => `{ id: '${ci.id}', amount: ${ci.amount} }`).join(', ');
        costParts.push(`items: [${itemsStr}]`);
      }
      if (objCost.tools && objCost.tools.length > 0) {
        const toolsStr = objCost.tools.map(t => `'${t}'`).join(', ');
        costParts.push(`tools: [${toolsStr}]`);
      }
      costParts = costParts.filter(p => p); 
      return `{ ${costParts.join(', ')} }`;
    }
  }

  public async deletePassage(passageId: string): Promise<void> {
    const parts = validatePassageId(passageId);
    if (!parts) {
      throw new Error(`Invalid passageId format for deletion: ${passageId}`);
    }
    const [eventId, characterId, passagePartId] = parts;

    const primaryPassageParentDir = path.join(eventsDir(), eventId, `${characterId}${evnetPassagesFilePostfixWithoutFileType}`);
    let passageFilePath = path.join(primaryPassageParentDir, `${passagePartId}${passageFilePostfix}`);

    if (!fileSystem.existsSync(passageFilePath)) {
        const alternativePassageParentDir = path.join(eventsDir(), eventId, characterId, 'passages');
        const alternativePassageFilePath = path.join(alternativePassageParentDir, `${passagePartId}${passageFilePostfix}`);
        if (fileSystem.existsSync(alternativePassageFilePath)) {
            passageFilePath = alternativePassageFilePath;
        } else {
            throw new Error(`Passage file to delete not found at ${passageFilePath} or ${alternativePassageFilePath}`);
        }
    }
    
    try {
        fileSystem.unlinkSync(passageFilePath);
        console.log(`Passage file ${passageFilePath} deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting passage file ${passageFilePath}:`, error);
        throw new Error(`Failed to delete passage file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async openPassage(passageId: string): Promise<void> {
    const parts = validatePassageId(passageId);
    if (!parts) {
        throw new Error(`Invalid passageId format for opening: ${passageId}`);
    }
    const [eventId, characterId, passagePartId] = parts;

    const primaryPassageParentDir = path.join(eventsDir(), eventId, `${characterId}${evnetPassagesFilePostfixWithoutFileType}`);
    let passageFilePath = path.join(primaryPassageParentDir, `${passagePartId}${passageFilePostfix}`);

    if (!fileSystem.existsSync(passageFilePath)) {
        const alternativePassageParentDir = path.join(eventsDir(), eventId, characterId, 'passages');
        const alternativePassageFilePath = path.join(alternativePassageParentDir, `${passagePartId}${passageFilePostfix}`);
        if (fileSystem.existsSync(alternativePassageFilePath)) {
            passageFilePath = alternativePassageFilePath;
        } else {
            throw new Error(`Passage file to open not found at ${passageFilePath} or ${alternativePassageFilePath}`);
        }
    }

    try {
        await this.editorAdapter.openFile(passageFilePath);
        console.log(`File opened via editor adapter: ${passageFilePath}`);
    } catch (error) {
        console.error(`Error opening passage file ${passageFilePath} in editor:`, error);
        throw new Error(`Failed to open passage file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const passageManager = new PassageManager();