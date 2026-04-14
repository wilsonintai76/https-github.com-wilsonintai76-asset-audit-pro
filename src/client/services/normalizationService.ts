/**
 * Utility Service for normalizing and parsing messy location strings from CSV data.
 */

export interface ParsedLocation {
  buildingName: string;
  level: string;
  roomName: string;
}

export const normalizationService = {
  /**
   * Parses a raw location string into structured components.
   * Example: "Asrama Lelaki Blok AAras 3Bilik 09" -> { buildingName: "Asrama Lelaki Blok A", level: "3", roomName: "Bilik 09" }
   */
  parseLocationString(raw: string): ParsedLocation {
    let buildingName = '';
    let level = '';
    let roomName = raw.trim();

    // 1. Try to extract Level (Aras / Level / Tingkat)
    const levelPatterns = [
      /(?:Aras|Level|Tingkat)\s*(\d+)/i,  // "Aras 3", "Level 02"
      /(\d+)\s*(?:nd|rd|th|st)?\s*Floor/i // "2nd Floor"
    ];

    for (const pattern of levelPatterns) {
      const match = roomName.match(pattern);
      if (match) {
        level = match[1];
        // Split the string at the level match
        const parts = roomName.split(match[0]);
        if (parts.length >= 2) {
          buildingName = parts[0].trim();
          roomName = parts.slice(1).join(match[0]).trim();
        }
        break;
      }
    }

    // 2. Try to extract Building if still attached to roomName (common in concatenated strings)
    // If we have "Asrama Lelaki Blok A09", and no "Aras" was found
    if (!buildingName && roomName.match(/(Blok|Block|Building|Bangunan)\s*[A-Z0-9]+/i)) {
      const bldgMatch = roomName.match(/(.*(?:Blok|Block|Building|Bangunan)\s*[A-Z0-9]+)(.*)/i);
      if (bldgMatch) {
        buildingName = bldgMatch[1].trim();
        roomName = bldgMatch[2].trim();
      }
    }

    // 3. Fallback: If roomName is still long and contains 'Bilik' or 'Lab'
    if (roomName.match(/(Bilik|Lab|Makmal|Pejabat)\s*\d+/i)) {
      const roomMatch = roomName.match(/(.*?)(Bilik|Lab|Makmal|Pejabat.*)/i);
      if (roomMatch) {
         if (!buildingName) buildingName = roomMatch[1].trim();
         roomName = roomMatch[2].trim();
      }
    }

    return {
      buildingName: buildingName || 'Unknown Building',
      level: level || 'G',
      roomName: roomName || raw
    };
  },

  /**
   * Generates a unique key for matching raw strings to normalized locations.
   */
  generateMappingKey(raw: string): string {
    return raw.toUpperCase().replace(/\s+/g, '').trim();
  }
};
