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
 * Request object for updating an event
 * @interface EventUpdateRequest
 * @property {string} title - The title of the event
 * @property {string} description - The description of the event
 * @property {string} location - The location where the event takes place
 * @property {TimeRange} timeRange - The time range for the event
 */
export interface EventUpdateRequest {
  title?: string;
  description?: string;
  location?: string;
  timeRange?: TimeRange;
}

/**
 * Request object for setting the time of an event
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

// New Map related type definitions
export interface MapData {
  mapId: string;  // Added missing field
  title: string;
  width: number;
  height: number;
  data: MapTileData[][];
  locations: MapLocationReference[];
  maps: MapMapReference[];
  palette: Record<string, { name: string; color: string; }>;  // Added missing field
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

export type TEventData = {
  title: string;
  description: string;
  locationId: string;
  timeRange: {
    start: string;
    end: string;
  };
};

export type TPassageData = {
  type: string;
  title?: string;
};

export type TEventPassageType = "screen" | "linear" | "transition";
