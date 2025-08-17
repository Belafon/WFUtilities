/**
 * Type definitions for the WFNodeServer library
 */

/**
 * Represents a time range with a start and end time
 * @interface TimeRange
 * @property {string} start - Date and time in format 'D.M. H:mm' (e.g. '2.1. 8:00')
 * @property {string} end - Date and time in format 'D.M. H:mm' (e.g. '5.1. 8:00')
 */
export interface TimeRange {
  start: string;
  end: string;
}

/**
 * Represents a child chapter with a condition
 * @interface TChildChapter
 * @property {string} condition - The condition that triggers this child chapter
 * @property {string} chapterId - The ID of the child chapter to trigger
 */
export interface TChildChapter {
  condition: string;
  chapterId: string;
}

/**
 * Request object for updating an chapter
 * @interface ChapterUpdateRequest
 * @property {string} title - The title of the chapter
 * @property {string} description - The description of the chapter
 * @property {string} location - The location where the chapter takes place
 * @property {TimeRange} timeRange - The time range for the chapter
 * @property {TChildChapter[]} children - Array of conditional child chapters
 */
export interface ChapterUpdateRequest {
  title?: string;
  description?: string;
  location?: string;
  timeRange?: TimeRange;
  children?: TChildChapter[];
}

/**
 * Request object for setting the time of an chapter
 * @interface SetTimeRequest
 * @property {TimeRange} timeRange - The new time range to set
 */
export interface SetTimeRequest {
  timeRange: TimeRange;
}

export interface TLinkCostObjectUpdateRequest {
  time?: {
    value: number;
    unit: 'min' | 'hour' | 'day';
  };
  items?: TLinkCostItem[];
  tools?: string[];
}

export interface TLinkCostItem {
  id: string;
  amount: number;
}

export type TLinkCostUpdateRequest = 
  | { value: number; unit: 'min' | 'hour' | 'day' }
  | TLinkCostObjectUpdateRequest;

export interface TLinkUpdateRequest {
  text?: string;
  passageId?: string;
  autoPriority?: number;
  cost?: TLinkCostUpdateRequest;
}

export interface TPassageScreenBodyItemUpdateRequest {
  condition?: boolean;
  redirect?: string;
  text?: string;
  links?: TLinkUpdateRequest[];
}

export interface ScreenPassageUpdateRequest {
  type: 'screen' | 'linear' | 'transition';
  title?: string;
  image?: string;
  body?: TPassageScreenBodyItemUpdateRequest[];
  description?: string;
  nextPassageId?: string;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

// Updated Map related type definitions to include missing fields
export interface MapTileData {
  tile: string;
  title?: string;
}

export interface MapLocationReference {
  i: number;
  j: number;
  locationId: string;
}

export interface MapMapReference {
  i: number;
  j: number;
  mapId: string;
}

export interface MapData {
  mapId: string;
  title: string;
  width: number;
  height: number;
  data: MapTileData[][];
  locations: MapLocationReference[];
  maps: MapMapReference[];
  palette: Record<string, { name: string; color: string; }>;  
}

export interface MapUpdateRequest extends MapData {}

export interface MapResponse {
  success: boolean;
  data: MapData;
}

export interface MapListResponse {
  success: boolean;
  data: string[];
}

export type TChapterData = {
  title: string;
  description: string;
  location: string;
  timeRange: {
    start: string;
    end: string;
  };
};

export type TScreenPassageData = {
  type: TChapterPassageType;
  chapterId: string;
  characterId: string;
  id: string;
  title: string;
  image: string;
  body: Array<{
    text?: string;
    redirect?: string;
    links?: Array<{
      text: string;
      passageId: string;
      autoPriority: number;
      cost?: any; // You might want to define TLinkCost type more specifically
    }>;
  }>;
};

export type TChapterPassageType = "screen" | "linear" | "transition";
