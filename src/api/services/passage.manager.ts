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

    // Construct primary and alternative file paths
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
    
    // Attempt to find the passage definition, trying common naming patterns
    const funcNamePattern = `${passagePartId}Passage`; // e.g., visitPassage
    const varNamePattern = passagePartId;          // e.g., visit

    // 1. Try finding as a returned object from a function (e.g., export const visitPassage = () => ({ ... }))
    codeBuilder.findReturnObjectInFunction(funcNamePattern, {
        onFound: (objBuilder) => { passageObjectBuilder = objBuilder; },
        onNotFound: () => {}
    });

    // 2. If not found, try as a top-level variable with "Passage" suffix (e.g., export const visitPassage = { ... })
    if (!passageObjectBuilder) {
        codeBuilder.findObject(funcNamePattern, {
            onFound: (objBuilder) => { passageObjectBuilder = objBuilder; },
            onNotFound: () => {}
        });
    }
    
    // 3. If still not found, try as a top-level variable with direct name (e.g., export const visit = { ... })
    if (!passageObjectBuilder) {
        codeBuilder.findObject(varNamePattern, {
            onFound: (objBuilder) => { passageObjectBuilder = objBuilder; },
            onNotFound: () => {}
        });
    }

    if (!passageObjectBuilder) {
      throw new Error(`Could not find passage definition (object or function return) for '${passagePartId}' (tried patterns: ${funcNamePattern}, ${varNamePattern}) in ${resolvedPassageFilePath}`);
    }

    // Update properties based on passageData
    // The 'type' property in the passage object itself should be updated to reflect passageData.type
    passageObjectBuilder.setPropertyValue('type', `'${passageData.type}'`);

    if (passageData.title !== undefined) {
      passageObjectBuilder.setPropertyValue('title', this.formatStringForI18nCode(passageData.title));
    }

    if (passageData.image !== undefined) {
      passageObjectBuilder.setPropertyValue('image', `'${passageData.image}'`); // Image paths are usually direct strings
    }

    if (passageData.type === 'screen') {
      if (passageData.body !== undefined) {
        const bodyString = this.convertPassageBodyToString(passageData.body);
        passageObjectBuilder.setPropertyValue('body', bodyString);
      }
    } else if (passageData.type === 'linear') {
      if (passageData.description !== undefined) {
        // Linear passages use 'description' for main text, might be a direct string or i18n key
        passageObjectBuilder.setPropertyValue('description', this.formatStringForI18nCode(passageData.description));
      }
      if (passageData.nextPassageId !== undefined) {
        passageObjectBuilder.setPropertyValue('nextPassageId', `'${passageData.nextPassageId}'`);
      }
    } else if (passageData.type === 'transition') {
      if (passageData.nextPassageId !== undefined) {
        passageObjectBuilder.setPropertyValue('nextPassageId', `'${passageData.nextPassageId}'`);
      }
    }

    const updatedContent = await codeBuilder.toString();
    fileSystem.writeFileSync(resolvedPassageFilePath, updatedContent, 'utf-8');
  }

  private formatStringForI18nCode(value: string): string {
    const trimmedValue = value.trim();
    // Check if it already looks like an i18n call _('...') or _("...")
    if (trimmedValue.startsWith("_(") && trimmedValue.endsWith(")")) {
        const inner = trimmedValue.substring(2, trimmedValue.length - 1).trim();
        // Ensure inner part is a single or double quoted string
        if ((inner.startsWith("'") && inner.endsWith("'")) || (inner.startsWith('"') && inner.endsWith('"'))) {
            return trimmedValue; // It's a valid _('key') or _("key")
        }
    }
    // If it's a literal string like 'my text' or "my text" from the request
    if ((trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) || (trimmedValue.startsWith('"') && trimmedValue.endsWith('"'))) {
        const bareString = trimmedValue.substring(1, trimmedValue.length - 1);
        // Convert literal to _('literal'), escaping single quotes within the key
        return `_('${bareString.replace(/'/g, "\\'")}')`;
    }
    // Otherwise, assume it's a key that needs to be wrapped and quoted
    return `_('${trimmedValue.replace(/'/g, "\\'")}')`;
}

  private convertPassageBodyToString(bodyItems: TPassageScreenBodyItemUpdateRequest[]): string {
    const itemsStr = bodyItems.map(item => {
      let itemParts: string[] = [];
      if (item.condition !== undefined) {
        // Assuming condition is a simple boolean from request. Code might have complex expressions.
        // For robust update, this might need parsing or smarter generation if conditions are not just booleans.
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
            // Check your TLink type for exact key: autoPriority or autoPriortiy
            linkParts.push(`autoPriority: ${link.autoPriority}`); 
          }
          if (link.cost !== undefined) {
            linkParts.push(`cost: ${this.convertLinkCostToString(link.cost)}`);
          }
          linkParts = linkParts.filter(p => p); // Remove undefined/empty parts
          return `{\n              ${linkParts.join(',\n              ')}\n            }`;
        }).join(',\n            ');
        itemParts.push(`links: [\n            ${linksStr}\n          ]`);
      }
      itemParts = itemParts.filter(p => p); // Remove undefined/empty parts
      return `{\n        ${itemParts.join(',\n        ')}\n      }`;
    }).join(',\n      ');

    return `[\n      ${itemsStr}\n    ]`;
  }

  private convertLinkCostToString(cost: TLinkCostUpdateRequest): string {
    // Check for simple DeltaTime form: { value: number; unit: 'min' | 'hour' | 'day' }
    if ('value' in cost && 'unit' in cost && typeof cost.value === 'number' && typeof cost.unit === 'string') {
      const unit = cost.unit.toLowerCase();
      // Ensure DeltaTime is imported in the target file or this won't be valid TS code.
      if (unit === 'min') return `DeltaTime.fromMin(${cost.value})`;
      if (unit === 'hour') return `DeltaTime.fromHours(${cost.value})`; // Assuming DeltaTime.fromHours
      if (unit === 'day') return `DeltaTime.fromDays(${cost.value})`;   // Assuming DeltaTime.fromDays
      console.warn(`Unknown DeltaTime unit for cost: ${cost.unit}`);
      return '{}'; // Fallback for unrecognized unit
    } else {
      // Assumed to be TLinkCostObjectUpdateRequest
      const objCost = cost as TLinkCostObjectUpdateRequest;
      let costParts: string[] = [];
      if (objCost.time) { // objCost.time is { value, unit }
        costParts.push(`time: ${this.convertLinkCostToString(objCost.time)}`); // Recursive call
      }
      if (objCost.items && objCost.items.length > 0) {
        const itemsStr = objCost.items.map(ci => `{ id: '${ci.id}', amount: ${ci.amount} }`).join(', ');
        costParts.push(`items: [${itemsStr}]`);
      }
      if (objCost.tools && objCost.tools.length > 0) {
        const toolsStr = objCost.tools.map(t => `'${t}'`).join(', ');
        costParts.push(`tools: [${toolsStr}]`);
      }
      costParts = costParts.filter(p => p); // Remove undefined/empty parts
      return `{ ${costParts.join(', ')} }`;
    }
  }

  /**
   * Deletes a passage
   * @param passageId The ID of the passage to delete
   */
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
        // Further logic might be needed to update any indexes or dependent files.
    } catch (error) {
        console.error(`Error deleting passage file ${passageFilePath}:`, error);
        throw new Error(`Failed to delete passage file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Opens a passage in the editor
   * @param passageId The ID of the passage to open
   */
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
        // Use the editor adapter to open the file
        await this.editorAdapter.openFile(passageFilePath);
        console.log(`File opened via editor adapter: ${passageFilePath}`);
    } catch (error) {
        console.error(`Error opening passage file ${passageFilePath} in editor:`, error);
        throw new Error(`Failed to open passage file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export a singleton instance with the default adapter
export const passageManager = new PassageManager();